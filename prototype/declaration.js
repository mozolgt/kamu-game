"use strict";

globalThis.createDeclarationPicker = ({ lockedFamily, validate, submit, challenge }) => {
  const { families, parameterOptions } = BluffmasterEngine.combinations;
  const { ranks, label, symbols } = BluffmasterPresentation;
  const byId = id => document.getElementById(id);
  const picker = byId("declaration-picker");
  const trigger = byId("declare");
  const panel = byId("declaration-wheel");
  const face = panel.querySelector(".wheel-face");
  const heading = byId("wheel-step");
  const familyRing = byId("wheel-families");
  const optionRing = byId("wheel-options");
  const trail = byId("wheel-trail");
  const summary = byId("wheel-summary");
  const confirm = byId("confirm-bid");
  const center = byId("wheel-challenge");

  const stepsByFamily = {
    Set: ["length", "rank"],
    "Double Set": ["length", "rank", "secondLength", "secondRank"],
    Straight: ["length", "rank"],
    "Straight Flush": ["length", "rank", "suit"],
    Flush: ["length", "suit"],
  };
  const stepTitles = {
    length: "Choose the card count",
    rank: "Choose a rank",
    secondLength: "Choose the second count",
    secondRank: "Choose the second rank",
    suit: "Choose a suit",
  };

  let path = [];
  let cursor = 0;

  function steps() {
    return ["family", ...(stepsByFamily[path[0]?.value] || [])];
  }

  function bidFromPath() {
    return Object.fromEntries(path.map(({ name, value }) => [name, value]));
  }

  function stepTitle(name, bid) {
    if (bid.family === "Double Set" && name === "length") return "Choose the first count";
    if (bid.family === "Double Set" && name === "rank") return "Choose the first rank";
    if (bid.family.includes("Straight") && name === "rank") return "Choose a starting rank";
    return stepTitles[name];
  }

  function optionsFor(name, bid) {
    const choices = (values, label = String) => values.map(value => ({ name, value, label: label(value) }));
    const values = parameterOptions(name, bid);
    if (name === "rank" || name === "secondRank") {
      return choices(values, rank => rank === 1 ? "A low" : ranks[rank]);
    }
    return choices(values);
  }

  function point(radius, angle) {
    const radians = angle * Math.PI / 180;
    return [50 + radius * Math.sin(radians), 50 - radius * Math.cos(radians)];
  }

  function sector(inner, outer, start, end) {
    const largeArc = Number(end - start > 180);
    return [
      `M ${point(outer, start)} A ${outer},${outer} 0 ${largeArc} 1 ${point(outer, end)}`,
      `L ${point(inner, end)} A ${inner},${inner} 0 ${largeArc} 0 ${point(inner, start)} Z`,
    ].join(" ");
  }

  function drawRing(container, options, index, inner, outer, locked = false) {
    const span = 360 / options.length;
    const selected = path[index]?.value;
    const buttons = options.map((choice, position) => {
      const angle = position * span;
      const active = choice.value === selected;
      const wedge = document.createElementNS("http://www.w3.org/2000/svg", "path");
      wedge.setAttribute("d", sector(inner, outer, angle - span / 2 + .8, angle + span / 2 - .8));
      wedge.classList.toggle("selected", active);
      if (locked) wedge.classList.add("locked");
      else wedge.addEventListener("click", () => select(index, choice));
      face.append(wedge);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "wheel-option";
      button.textContent = choice.label;
      if (choice.name === "suit") {
        button.classList.add("wheel-suit");
        if (choice.value === "Hearts" || choice.value === "Diamonds") button.classList.add("red");
        button.textContent = `${symbols[choice.value]}\uFE0E`;
        button.setAttribute("aria-label", choice.label);
        button.title = choice.label;
      }
      button.setAttribute("aria-pressed", active);
      button.disabled = locked;
      const [x, y] = point((inner + outer) / 2, angle);
      button.style.left = `${x}%`;
      button.style.top = `${y}%`;
      if (!locked) {
        button.addEventListener("pointerenter", () => wedge.classList.add("hovered"));
        button.addEventListener("pointerleave", () => wedge.classList.remove("hovered"));
        button.addEventListener("click", () => select(index, choice));
      }
      return button;
    });
    container.replaceChildren(...buttons);
  }

  function draw() {
    const complete = path.length === steps().length;
    const choiceIndex = complete && cursor === path.length ? cursor - 1 : cursor;
    face.replaceChildren();
    const family = lockedFamily();
    drawRing(familyRing, (family ? [family] : families).map(familyChoice), 0, 12, 30, Boolean(family));
    optionRing.replaceChildren();

    if (choiceIndex > 0) {
      const bid = bidFromPath();
      const name = steps()[choiceIndex];
      heading.textContent = complete && cursor === path.length ? "Review declaration" : stepTitle(name, bid);
      for (let index = 1; index < choiceIndex; index++) {
        const band = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        band.setAttribute("cx", 50);
        band.setAttribute("cy", 50);
        band.setAttribute("r", 30 + index * 1.5);
        face.append(band);
      }
      drawRing(optionRing, optionsFor(name, bid), choiceIndex, 36, 49);
    } else {
      heading.textContent = "Choose a family";
    }

    trail.hidden = path.length <= 1;
    trail.replaceChildren(...path.slice(1).map(({ name, label }, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute("aria-label", `${stepTitle(name, bidFromPath())}: ${label}`);
      button.setAttribute("aria-pressed", index + 1 === choiceIndex);
      button.addEventListener("click", () => {
        cursor = index + 1;
        draw();
        focusOption();
      });
      return button;
    }));

    const bid = complete ? bidFromPath() : null;
    const error = bid ? validate(bid) : "";
    summary.hidden = !bid;
    summary.textContent = bid ? error || label(bid) : "";
    confirm.hidden = !bid;
    confirm.disabled = Boolean(error);
  }

  function focusOption() {
    const ring = cursor ? optionRing : familyRing;
    const target = ring.querySelector('[aria-pressed="true"]') || ring.querySelector("button");
    target?.focus({ preventScroll: true });
  }

  function select(index, choice) {
    if (path[index]?.value !== choice.value) path = [...path.slice(0, index), choice];
    cursor = index + 1;
    draw();
    if (!confirm.hidden && !confirm.disabled && cursor === path.length) {
      confirm.focus({ preventScroll: true });
    } else {
      focusOption();
    }
  }

  function open(focus = false) {
    if (panel.hidden) {
      const family = lockedFamily();
      if (family && path[0]?.value !== family) {
        path = [familyChoice(family)];
        cursor = 1;
      }
      draw();
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    }
    if (focus) focusOption();
  }

  function familyChoice(value) {
    return { name: "family", value, label: value };
  }

  function close(restoreFocus = false) {
    if (panel.hidden) return;
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  trigger.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse") open();
  });
  trigger.addEventListener("click", () => open(true));
  picker.addEventListener("pointerleave", event => {
    if (event.pointerType === "mouse") close(panel.contains(document.activeElement));
  });
  picker.addEventListener("focusout", event => {
    if (event.relatedTarget && !picker.contains(event.relatedTarget)) close();
  });
  picker.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      close(true);
    }
  });
  document.addEventListener("pointerdown", event => {
    if (!picker.contains(event.target)) close();
  });
  byId("close-wheel").addEventListener("click", () => close(true));
  center.addEventListener("click", challenge);
  confirm.addEventListener("click", () => {
    const bid = bidFromPath();
    if (path.length === steps().length && !validate(bid)) submit(bid);
  });

  return {
    reset() {
      path = [];
      cursor = 0;
      close();
    },
    setChallengeAvailable(available) {
      center.disabled = !available;
    },
  };
};
