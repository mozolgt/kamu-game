import pandas as pd

# Load CSV
df = pd.read_csv("simulation_results.csv")

# Convert 'Details' column from string to tuple/list if needed
df['Details'] = df['Details'].apply(eval)

# Create a unified key column for subset identification
df['Subset'] = df.apply(lambda row: (row['Family'], tuple(row['Details'])), axis=1)

# === 1. Frequency of Any Instance of a Subset Family (e.g. Double Set) ===
target_family = "Double Set"

# Filter rows for this family
df_family = df[df['Family'] == target_family]

# Count how many unique subsets (e.g., Double Set [2,2]) per hand size
any_instance = df_family.groupby('Hand Size')['Subset'].nunique().reset_index()
any_instance.columns = ['Hand Size', 'Unique Subsets Found']

# Save to CSV
any_instance.to_csv("any_instance_summary.csv", index=False)
print("✅ Saved: any_instance_summary.csv")

# === 2. Frequency of Named Subsets (e.g. Double Set 2,2 Kings and Jacks) ===
named_instance = df.groupby(['Hand Size', 'Subset'])['Count'].sum().reset_index()

# Save to CSV
named_instance.to_csv("named_instance_summary.csv", index=False)
print("✅ Saved: named_instance_summary.csv")