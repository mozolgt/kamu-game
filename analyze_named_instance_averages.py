import argparse
import ast
import json
from typing import Any, Tuple

import pandas as pd

RANK_ORDER = {
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    "J": 11,
    "Q": 12,
    "K": 13,
    "A": 14,
}

FAMILY_ORDER = {
    "Set": 1,
    "Double Set": 2,
    "Straight": 3,
    "Flush": 4,
    "Straight Flush": 5,
    "Other": 99,
}

FAMILY_HUES = {
    "Set": 215,  # blue
    "Double Set": 250,  # indigo
    "Straight": 135,  # green
    "Flush": 8,  # red
    "Straight Flush": 295,  # magenta
    "Other": 0,
}


def parse_subset(value: str) -> Tuple[str, Any]:
    parsed = ast.literal_eval(value)
    if not isinstance(parsed, tuple) or len(parsed) != 2:
        raise ValueError(f"Unexpected Subset format: {value}")
    family, details = parsed
    return str(family), details


def family_of_subset_label(subset_label: str) -> str:
    if subset_label.startswith("Straight Flush"):
        return "Straight Flush"
    if subset_label.startswith("Double Set"):
        return "Double Set"
    if subset_label.startswith("Straight"):
        return "Straight"
    if subset_label.startswith("Flush"):
        return "Flush"
    if subset_label.startswith("Set"):
        return "Set"
    return "Other"


def subset_sort_key(subset_label: str) -> tuple:
    family = family_of_subset_label(subset_label)
    if family == "Double Set":
        right = subset_label.replace("Double Set ", "", 1)
        left_part, right_part = right.split("-")
        return (FAMILY_ORDER[family], int(left_part), int(right_part))
    if family in {"Set", "Straight", "Flush", "Straight Flush"}:
        return (FAMILY_ORDER[family], int(subset_label.split(" ")[-1]))
    return (FAMILY_ORDER["Other"], subset_label)


def normalize_subset(family: str, details: Any) -> tuple[str, tuple]:
    if family == "Set":
        size, rank = details
        subset_group = f"Set {int(size)}"
        named_variant = ("Set", int(size), str(rank))
        return subset_group, named_variant

    if family == "Double Set":
        (x, y), (r1, r2) = details
        x, y = int(x), int(y)
        r1, r2 = str(r1), str(r2)

        # Canonicalize rank order to remove random orientation caused by hand order.
        if RANK_ORDER[r1] > RANK_ORDER[r2]:
            r1, r2 = r2, r1
            x, y = y, x

        subset_group = f"Double Set {x}-{y}"
        named_variant = ("Double Set", (x, y), (r1, r2))
        return subset_group, named_variant

    if family == "Straight":
        length, start = details
        subset_group = f"Straight {int(length)}"
        named_variant = ("Straight", int(length), int(start))
        return subset_group, named_variant

    if family == "Flush":
        length, _highest, suit = details
        subset_group = f"Flush {int(length)}"
        # Ignore highest-card label to avoid over-fragmentation in source data.
        named_variant = ("Flush", int(length), str(suit))
        return subset_group, named_variant

    if family == "Straight Flush":
        length, start, suit = details
        subset_group = f"Straight Flush {int(length)}"
        named_variant = ("Straight Flush", int(length), int(start), str(suit))
        return subset_group, named_variant

    return family, (family, details)


def infer_simulation_count(df: pd.DataFrame) -> int:
    hand_52 = df[df["Hand Size"] == 52]
    if hand_52.empty:
        raise ValueError("Cannot infer simulation count: no rows with Hand Size = 52.")

    max_count = int(hand_52["Count"].max())
    if max_count <= 0:
        raise ValueError("Cannot infer simulation count: max Count at Hand Size 52 is not positive.")
    return max_count


def _nice_x_ticks(unique_x: list[int]) -> list[int]:
    if not unique_x:
        return []
    if len(unique_x) <= 14:
        return unique_x

    first = unique_x[0]
    last = unique_x[-1]
    ticks = [first]
    step = 5
    current = ((first + step - 1) // step) * step
    while current < last:
        ticks.append(current)
        current += step
    if ticks[-1] != last:
        ticks.append(last)
    return ticks


def build_subset_color_map(subsets: list[str]) -> dict[str, str]:
    ordered_subsets = sorted(subsets, key=subset_sort_key)
    by_family: dict[str, list[str]] = {}
    for subset in ordered_subsets:
        by_family.setdefault(family_of_subset_label(subset), []).append(subset)

    colors: dict[str, str] = {}
    for family, family_subsets in by_family.items():
        hue = FAMILY_HUES.get(family, 0)
        count = len(family_subsets)
        for idx, subset in enumerate(family_subsets):
            if count == 1:
                lightness = 45.0
            else:
                lightness = 34.0 + (24.0 * idx / (count - 1))
            colors[subset] = f"hsl({hue},72%,{lightness:.1f}%)"
    return colors


def generate_interactive_dashboard(output_df: pd.DataFrame, output_path: str) -> None:
    subsets = sorted(output_df["Subset"].unique().tolist(), key=subset_sort_key)
    subset_colors = build_subset_color_map(subsets)

    series = []
    for subset_name in subsets:
        part = output_df[output_df["Subset"] == subset_name].sort_values("Hand Size")
        family = family_of_subset_label(subset_name)
        points = [
            [int(row["Hand Size"]), float(row["Average Count (%)"])]
            for _, row in part.iterrows()
        ]
        series.append(
            {
                "subset": subset_name,
                "family": family,
                "color": subset_colors[subset_name],
                "points": points,
            }
        )

    families = sorted(
        {item["family"] for item in series},
        key=lambda fam: FAMILY_ORDER.get(fam, 99),
    )
    payload = {
        "series": series,
        "families": families,
        "familyOrder": FAMILY_ORDER,
    }
    payload_json = json.dumps(payload, separators=(",", ":"))

    html_doc = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Named Instance Dashboard</title>
  <style>
    :root {
      --bg: #f6f7f9;
      --card: #ffffff;
      --line: #d8dbe3;
      --text: #1f2937;
      --subtle: #6b7280;
      --accent: #0f766e;
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    }
    .page {
      max-width: 1500px;
      margin: 18px auto;
      padding: 0 14px;
    }
    .layout {
      display: grid;
      gap: 14px;
      grid-template-columns: 290px 1fr;
    }
    .panel, .chart-panel {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 10px;
      box-shadow: 0 1px 1px rgba(0, 0, 0, 0.03);
    }
    .panel {
      padding: 12px;
      align-self: start;
      position: sticky;
      top: 10px;
      max-height: calc(100vh - 40px);
      overflow: auto;
    }
    .chart-panel {
      padding: 12px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 20px;
    }
    .hint {
      margin: 0 0 10px;
      color: var(--subtle);
      font-size: 13px;
    }
    .btn-row {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }
    button {
      border: 1px solid #b8bfcc;
      background: #fdfdfd;
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    button:hover {
      background: #f4f7fb;
    }
    .family-list {
      display: grid;
      gap: 5px;
      margin-bottom: 10px;
    }
    .family-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .swatch {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      flex: 0 0 12px;
    }
    #summary {
      font-size: 12px;
      color: var(--subtle);
      margin-bottom: 10px;
    }
    #legend {
      border-top: 1px solid var(--line);
      padding-top: 10px;
      font-size: 12px;
    }
    .legend-family {
      margin-bottom: 6px;
      font-weight: 600;
      color: #374151;
    }
    .legend-subset {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 3px 0;
      color: #4b5563;
    }
    .legend-line {
      width: 18px;
      height: 0;
      border-top: 2px solid;
      flex: 0 0 18px;
    }
    #chart {
      width: 100%;
      height: 760px;
      display: block;
      background: #fff;
    }
    @media (max-width: 1080px) {
      .layout { grid-template-columns: 1fr; }
      .panel {
        position: static;
        max-height: none;
      }
      #chart { height: 560px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="layout">
      <aside class="panel">
        <h1>Family Filters</h1>
        <p class="hint">Toggle families to show/hide lines in the chart.</p>
        <div class="btn-row">
          <button id="selectAllBtn" type="button">Select All</button>
          <button id="clearAllBtn" type="button">Clear All</button>
        </div>
        <div id="familyList" class="family-list"></div>
        <div id="summary"></div>
        <div id="legend"></div>
      </aside>
      <main class="chart-panel">
        <svg id="chart" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid meet"></svg>
      </main>
    </div>
  </div>
  <script>
    const DATA = __PAYLOAD__;
    const allSeries = DATA.series;
    const families = DATA.families;

    const state = {
      enabledFamilies: new Set(families)
    };

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function familyDisplayColor(family) {
      const first = allSeries.find((s) => s.family === family);
      return first ? first.color : "#666";
    }

    function uniqueXValues() {
      const values = new Set();
      for (const s of allSeries) {
        for (const point of s.points) {
          values.add(point[0]);
        }
      }
      return [...values].sort((a, b) => a - b);
    }

    function niceXTicks(values) {
      if (values.length <= 14) return values;
      const ticks = [values[0]];
      const first = values[0];
      const last = values[values.length - 1];
      let current = Math.ceil(first / 5) * 5;
      while (current < last) {
        ticks.push(current);
        current += 5;
      }
      if (ticks[ticks.length - 1] !== last) ticks.push(last);
      return ticks;
    }

    function renderControls() {
      const familyList = document.getElementById("familyList");
      familyList.innerHTML = families.map((family) => {
        const checked = state.enabledFamilies.has(family) ? "checked" : "";
        const color = familyDisplayColor(family);
        return `
          <label class="family-item">
            <input type="checkbox" data-family="${escapeHtml(family)}" ${checked} />
            <span class="swatch" style="background:${color}"></span>
            <span>${escapeHtml(family)}</span>
          </label>`;
      }).join("");

      for (const checkbox of familyList.querySelectorAll("input[type=checkbox]")) {
        checkbox.addEventListener("change", (event) => {
          const family = event.target.getAttribute("data-family");
          if (event.target.checked) {
            state.enabledFamilies.add(family);
          } else {
            state.enabledFamilies.delete(family);
          }
          renderChart();
          renderLegendAndSummary();
        });
      }
    }

    function renderLegendAndSummary() {
      const visibleSeries = allSeries.filter((s) => state.enabledFamilies.has(s.family));
      const summary = document.getElementById("summary");
      summary.textContent = `Visible families: ${state.enabledFamilies.size}/${families.length} | Visible subsets: ${visibleSeries.length}/${allSeries.length}`;

      const legend = document.getElementById("legend");
      if (visibleSeries.length === 0) {
        legend.innerHTML = "<div class='hint'>No families selected.</div>";
        return;
      }

      const byFamily = new Map();
      for (const s of visibleSeries) {
        if (!byFamily.has(s.family)) byFamily.set(s.family, []);
        byFamily.get(s.family).push(s);
      }

      let html = "";
      for (const family of families) {
        const group = byFamily.get(family);
        if (!group || group.length === 0) continue;
        html += `<div class="legend-family">${escapeHtml(family)}</div>`;
        for (const s of group) {
          html += `<div class="legend-subset"><span class="legend-line" style="border-color:${s.color}"></span><span>${escapeHtml(s.subset)}</span></div>`;
        }
      }
      legend.innerHTML = html;
    }

    function renderChart() {
      const svg = document.getElementById("chart");
      const visibleSeries = allSeries.filter((s) => state.enabledFamilies.has(s.family));

      const width = 1200;
      const height = 760;
      const marginLeft = 72;
      const marginTop = 32;
      const marginBottom = 56;
      const marginRight = 24;
      const plotX0 = marginLeft;
      const plotY0 = marginTop;
      const plotW = width - marginLeft - marginRight;
      const plotH = height - marginTop - marginBottom;
      const plotX1 = plotX0 + plotW;
      const plotY1 = plotY0 + plotH;

      const xValues = uniqueXValues();
      const xMin = xValues[0];
      const xMax = xValues[xValues.length - 1];
      const yMaxRaw = visibleSeries.flatMap((s) => s.points.map((p) => p[1]));
      const yMax = yMaxRaw.length === 0 ? 1 : Math.max(1, ...yMaxRaw);

      const sx = (x) => plotX0 + ((x - xMin) / (xMax - xMin || 1)) * plotW;
      const sy = (y) => plotY1 - (y / yMax) * plotH;

      let parts = [];
      parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#fff"></rect>`);
      parts.push(`<text x="${width / 2}" y="20" text-anchor="middle" font-size="17" fill="#111" font-family="Segoe UI, Arial">Average Named Instance Percentage by Hand Size</text>`);

      for (let i = 0; i <= 10; i += 1) {
        const yVal = (yMax / 10) * i;
        const yPos = sy(yVal);
        parts.push(`<line x1="${plotX0}" y1="${yPos.toFixed(2)}" x2="${plotX1}" y2="${yPos.toFixed(2)}" stroke="#e5e7eb" stroke-width="1"></line>`);
        parts.push(`<text x="${plotX0 - 8}" y="${(yPos + 4).toFixed(2)}" text-anchor="end" fill="#4b5563" font-size="10" font-family="Segoe UI, Arial">${yVal.toFixed(2)}</text>`);
      }

      for (const xVal of niceXTicks(xValues)) {
        const xPos = sx(xVal);
        parts.push(`<line x1="${xPos.toFixed(2)}" y1="${plotY0}" x2="${xPos.toFixed(2)}" y2="${plotY1}" stroke="#f0f2f6" stroke-width="1"></line>`);
        parts.push(`<text x="${xPos.toFixed(2)}" y="${plotY1 + 18}" text-anchor="middle" fill="#4b5563" font-size="10" font-family="Segoe UI, Arial">${xVal}</text>`);
      }

      parts.push(`<rect x="${plotX0}" y="${plotY0}" width="${plotW}" height="${plotH}" fill="none" stroke="#374151" stroke-width="1"></rect>`);
      parts.push(`<text x="${plotX0 + plotW / 2}" y="${height - 14}" text-anchor="middle" fill="#111" font-size="12" font-family="Segoe UI, Arial">Hand Size</text>`);
      parts.push(`<text x="19" y="${plotY0 + plotH / 2}" transform="rotate(-90 19 ${plotY0 + plotH / 2})" text-anchor="middle" fill="#111" font-size="12" font-family="Segoe UI, Arial">Average Named Instance (%)</text>`);

      for (const s of visibleSeries) {
        const points = s.points.map((p) => `${sx(p[0]).toFixed(2)},${sy(p[1]).toFixed(2)}`).join(" ");
        parts.push(`<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"></polyline>`);
      }

      if (visibleSeries.length === 0) {
        parts.push(`<text x="${plotX0 + plotW / 2}" y="${plotY0 + plotH / 2}" text-anchor="middle" fill="#9ca3af" font-size="16" font-family="Segoe UI, Arial">No families selected</text>`);
      }

      svg.innerHTML = parts.join("");
    }

    document.getElementById("selectAllBtn").addEventListener("click", () => {
      state.enabledFamilies = new Set(families);
      renderControls();
      renderLegendAndSummary();
      renderChart();
    });

    document.getElementById("clearAllBtn").addEventListener("click", () => {
      state.enabledFamilies = new Set();
      renderControls();
      renderLegendAndSummary();
      renderChart();
    });

    renderControls();
    renderLegendAndSummary();
    renderChart();
  </script>
</body>
</html>
"""
    html_doc = html_doc.replace("__PAYLOAD__", payload_json)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_doc)


def build_normalized_frame(raw_df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, row in raw_df.iterrows():
        family, details = parse_subset(row["Subset"])
        subset_group, named_variant = normalize_subset(family, details)
        rows.append(
            {
                "Hand Size": int(row["Hand Size"]),
                "Family": family_of_subset_label(subset_group),
                "Subset Group": subset_group,
                "Named Variant": named_variant,
                "Count": int(row["Count"]),
            }
        )
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Average named instances per subset type by hand size, then convert "
            "to percentage using simulation count."
        )
    )
    parser.add_argument(
        "--input",
        default="named_instance_summary.csv",
        help="Input CSV path (default: named_instance_summary.csv)",
    )
    parser.add_argument(
        "--output-csv",
        default="named_instance_average_percentages.csv",
        help="Output CSV path (default: named_instance_average_percentages.csv)",
    )
    parser.add_argument(
        "--output-dashboard",
        default="named_instance_average_dashboard.html",
        help="Output interactive HTML dashboard path (default: named_instance_average_dashboard.html)",
    )
    parser.add_argument(
        "--simulation-count",
        type=int,
        default=None,
        help="Override simulation count. If omitted, inferred from Hand Size 52 max Count.",
    )
    args = parser.parse_args()

    raw_df = pd.read_csv(args.input)
    required_cols = {"Hand Size", "Subset", "Count"}
    missing = required_cols - set(raw_df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    normalized_df = build_normalized_frame(raw_df)

    named_variants = (
        normalized_df.groupby("Subset Group")["Named Variant"]
        .nunique()
        .rename("Named Variant Count")
        .reset_index()
    )

    grouped = (
        normalized_df.groupby(["Hand Size", "Subset Group"], as_index=False)["Count"]
        .sum()
        .merge(named_variants, on="Subset Group", how="left")
    )
    grouped["Average Count"] = grouped["Count"] / grouped["Named Variant Count"]

    simulation_count = args.simulation_count
    if simulation_count is None:
        simulation_count = infer_simulation_count(raw_df)
    if simulation_count <= 0:
        raise ValueError("Simulation count must be positive.")

    grouped["Average Count (%)"] = (grouped["Average Count"] / simulation_count) * 100.0
    output_df = grouped[["Hand Size", "Subset Group", "Average Count (%)"]].rename(
        columns={"Subset Group": "Subset"}
    )
    output_df = output_df.sort_values(["Subset", "Hand Size"], key=lambda s: s).reset_index(drop=True)
    output_df.to_csv(args.output_csv, index=False)

    generate_interactive_dashboard(output_df, args.output_dashboard)

    hand_52 = output_df[output_df["Hand Size"] == 52]
    non_100 = hand_52[(hand_52["Average Count (%)"] - 100.0).abs() > 1e-9]

    print(f"Inferred simulation count: {simulation_count}")
    print("Normalization: Double Set rank order canonicalized; Flush averages ignore highest-rank label.")
    if non_100.empty:
        print("Check at Hand Size 52: all subset averages are 100%.")
    else:
        print("Check at Hand Size 52: subset averages not equal to 100%:")
        for _, row in non_100.sort_values("Subset").iterrows():
            print(f"  {row['Subset']}: {row['Average Count (%)']:.6f}%")

    print(f"Saved dataset: {args.output_csv}")
    print(f"Saved dashboard: {args.output_dashboard}")


if __name__ == "__main__":
    main()
