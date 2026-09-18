import pandas as pd
from pathlib import Path


def parse_file(filepath: str) -> tuple[pd.DataFrame, list[str]]:
    """Parse CSV or XLSX file, return (dataframe, column_names)."""
    path = Path(filepath)
    ext = path.suffix.lower()

    if ext == ".csv":
        df = pd.read_csv(filepath, dtype=str)
    elif ext in (".xlsx", ".xls"):
        df = pd.read_excel(filepath, dtype=str, engine="openpyxl")
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    df = df.where(pd.notnull(df), None)
    columns = list(df.columns)
    return df, columns
