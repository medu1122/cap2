"""
Data Manipulation Agent - Thực hiện các thao tác CRUD trên data source
- Tạo cột mới (computed, categorized)
- Sửa cột (rename, type, values)
- Xóa cột
- Thêm/Sửa/Xóa dòng
- Merge/Append CSV data
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ManipulationResult:
    """Kết quả của một thao tác manipulation"""
    success: bool
    action: str  # "create_column", "edit_column", "delete_column", "append_csv", etc.
    message: str
    affected_rows: int = 0
    affected_columns: list[str] = field(default_factory=list)
    new_data: list[dict] | None = None  # Updated data
    new_schema: list[dict] | None = None  # Updated schema
    error: str | None = None


@dataclass
class ColumnSpec:
    """Specification cho một cột"""
    name: str
    data_type: str = "text"  # "text" | "number" | "date"
    formula: str | None = None  # Công thức tính (nếu là computed column)


class DataManipulationAgent:
    """
    Agent để thực hiện các thao tác CRUD trên data source.
    
    Capabilities:
    - Create columns (computed, categorized)
    - Edit columns (rename, type, values)
    - Delete columns
    - Add/Edit/Delete rows
    - Append CSV data
    - Merge CSV data
    """
    
    def __init__(self):
        # Supported operations
        self.supported_operations = [
            "create_column",
            "edit_column",
            "delete_column",
            "add_row",
            "edit_row",
            "delete_row",
            "append_csv",
            "replace_csv",
            "merge_csv",
            "filter_data",
            "sort_data",
        ]
    
    async def execute(
        self,
        operation: str,
        data: list[dict],
        schema: list[dict],
        params: dict,
    ) -> ManipulationResult:
        """
        Execute a data manipulation operation.
        
        Args:
            operation: Loại operation ("create_column", "edit_column", etc.)
            data: List of rows
            schema: List of column definitions
            params: Parameters cho operation
        
        Returns:
            ManipulationResult với kết quả
        """
        try:
            if operation == "create_column":
                return await self._create_column(data, schema, params)
            elif operation == "edit_column":
                return await self._edit_column(data, schema, params)
            elif operation == "delete_column":
                return await self._delete_column(data, schema, params)
            elif operation == "add_row":
                return await self._add_row(data, schema, params)
            elif operation == "edit_row":
                return await self._edit_row(data, schema, params)
            elif operation == "delete_row":
                return await self._delete_row(data, schema, params)
            elif operation == "append_csv":
                return await self._append_csv(data, schema, params)
            elif operation == "replace_csv":
                return await self._replace_csv(data, schema, params)
            elif operation == "merge_csv":
                return await self._merge_csv(data, schema, params)
            elif operation == "filter_data":
                return await self._filter_data(data, schema, params)
            elif operation == "sort_data":
                return await self._sort_data(data, schema, params)
            else:
                return ManipulationResult(
                    success=False,
                    action=operation,
                    message=f"Operation '{operation}' không được hỗ trợ.",
                    error=f"Unknown operation: {operation}",
                )
        except Exception as e:
            return ManipulationResult(
                success=False,
                action=operation,
                message=f"Lỗi khi thực hiện: {str(e)}",
                error=str(e),
            )
    
    # ===== COLUMN OPERATIONS =====
    
    async def _create_column(
        self,
        data: list[dict],
        schema: list[dict],
        params: dict,
    ) -> ManipulationResult:
        """Tạo cột mới"""
        column_name = params.get("column_name", "")
        formula = params.get("formula", "")
        column_type = params.get("column_type", "text")
        
        if not column_name:
            return ManipulationResult(
                success=False,
                action="create_column",
                message="Cần cung cấp tên cột mới.",
            )
        
        if not formula and column_type != "text":
            return ManipulationResult(
                success=False,
                action="create_column",
                message="Cần cung cấp công thức hoặc giá trị cho cột mới.",
            )
        
        # Detect column type from formula
        if formula:
            column_type = self._detect_column_type_from_formula(formula)
        
        new_column = {
            "name": column_name,
            "data_type": column_type,
            "formula": formula,
        }
        
        # Calculate values for new column
        new_data = []
        for row in data:
            new_row = row.copy()
            if formula:
                value = self._evaluate_formula(formula, row, data)
                new_row[column_name] = value
            else:
                new_row[column_name] = params.get("default_value", "")
            new_data.append(new_row)
        
        # Add to schema
        new_schema = schema + [new_column]
        
        return ManipulationResult(
            success=True,
            action="create_column",
            message=f"Đã tạo cột '{column_name}' với {len(new_data)} dòng.",
            affected_rows=len(new_data),
            affected_columns=[column_name],
            new_data=new_data,
            new_schema=new_schema,
        )
    
    async def _edit_column(
        self,
        data: list[dict],
        schema: list[dict],
        params: dict,
    ) -> ManipulationResult:
        """Sửa cột (rename, type, values)"""
        old_name = params.get("old_name") or params.get("column_name", "")
        new_name = params.get("new_name", "")
        new_type = params.get("new_type", "")
        new_values = params.get("new_values", {})  # {row_index: new_value}
        
        # Find column in schema
        col_index = None
        for i, col in enumerate(schema):
            if col.get("name") == old_name:
                col_index = i
                break
        
        if col_index is None:
            return ManipulationResult(
                success=False,
                action="edit_column",
                message=f"Không tìm thấy cột '{old_name}'.",
            )
        
        new_schema = [col.copy() for col in schema]
        
        # Rename
        if new_name and new_name != old_name:
            new_schema[col_index]["name"] = new_name
            # Update data
            new_data = []
            for row in data:
                new_row = {k: v for k, v in row.items()}
                if old_name in new_row:
                    new_row[new_name] = new_row.pop(old_name)
                new_data.append(new_row)
        else:
            new_data = [row.copy() for row in data]
        
        # Update type
        if new_type:
            new_schema[col_index]["data_type"] = new_type
        
        # Update specific values
        if new_values:
            for row_idx, new_val in new_values.items():
                if 0 <= row_idx < len(new_data):
                    new_data[row_idx][new_schema[col_index]["name"]] = new_val
        
        action_desc = []
        if new_name and new_name != old_name:
            action_desc.append(f"đổi tên thành '{new_name}'")
        if new_type:
            action_desc.append(f"đổi type thành '{new_type}'")
        if new_values:
            action_desc.append(f"cập nhật {len(new_values)} giá trị")
        
        return ManipulationResult(
            success=True,
            action="edit_column",
            message=f"Đã {' và '.join(action_desc)} cho cột '{old_name}'.",
            affected_rows=len(new_data),
            affected_columns=[new_name or old_name],
            new_data=new_data,
            new_schema=new_schema,
        )
    
    async def _delete_column(
        self,
        data: list[dict],
        schema: list[dict],
        params: dict,
    ) -> ManipulationResult:
        """Xóa cột"""
        column_name = params.get("column_name", "")
        
        # Check if column exists
        col_exists = any(col.get("name") == column_name for col in schema)
        if not col_exists:
            return ManipulationResult(
                success=False,
                action="delete_column",
                message=f"Không tìm thấy cột '{column_name}'.",
            )
        
        # Remove from schema
        new_schema = [col for col in schema if col.get("name") != column_name]
        
        # Remove from data
        new_data = []
        for row in data:
            new_row = {k: v for k, v in row.items() if k != column_name}
            new_data.append(new_row)
        
        return ManipulationResult(
            success=True,
            action="delete_column",
            message=f"Đã xóa cột '{column_name}'.",
            affected_rows=len(new_data),
            affected_columns=[column_name],
            new_data=new_data,
            new_schema=new_schema,
        )
    
    # ===== ROW OPERATIONS =====
    
    async def _add_row(
        self,
        data: list[dict],
        schema: list[dict],
        params: dict,
    ) -> ManipulationResult:
        """Thêm dòng mới"""
        row_data = params.get("row_data", {})
        
        if not row_data:
            return ManipulationResult(
                success=False,
                action="add_row",
                message="Cần cung cấp dữ liệu cho dòng mới.",
            )
        
        # Get column names from schema
        col_names = [col.get("name") for col in schema]
        
        # Create new row with all columns
        new_row = {}
        for col in col_names:
            new_row[col] = row_data.get(col, "")
        
        new_data = data + [new_row]
        
        return ManipulationResult(
            success=True,
            action="add_row",
            message=f"Đã thêm dòng mới (tổng cộng {len(new_data)} dòng).",
            affected_rows=1,
            affected_columns=list(row_data.keys()),
            new_data=new_data,
            new_schema=schema,
        )
    
    async def _edit_row(
        self,
        data: list[dict],
        schema: list[dict],
        params: dict,
    ) -> ManipulationResult:
        """Sửa dòng"""
        row_index = params.get("row_index", 0)  # 0-indexed
        row_data = params.get("row_data", {})
        
        if row_index < 0 or row_index >= len(data):
            return ManipulationResult(
                success=False,
                action="edit_row",
                message=f"Không tìm thấy dòng #{row_index + 1}.",
            )
        
        new_data = [row.copy() for row in data]
        
        # Update values
        for key, value in row_data.items():
            new_data[row_index][key] = value
        
        return ManipulationResult(
            success=True,
            action="edit_row",
            message=f"Đã cập nhật dòng #{row_index + 1}.",
            affected_rows=1,
            affected_columns=list(row_data.keys()),
            new_data=new_data,
            new_schema=schema,
        )
    
    async def _delete_row(
        self,
        data: list[dict],
        schema: list[dict],
        params: dict,
    ) -> ManipulationResult:
        """Xóa dòng"""
        row_index = params.get("row_index", 0)
        row_indices = params.get("row_indices", [row_index])  # Multiple rows
        
        if not row_indices:
            return ManipulationResult(
                success=False,
                action="delete_row",
                message="Cần chỉ định dòng cần xóa.",
            )
        
        # Convert to 0-indexed
        indices_to_delete = [i - 1 if i > 0 else i for i in row_indices]
        
        # Remove rows
        new_data = [row for i, row in enumerate(data) if i not in indices_to_delete]
        
        return ManipulationResult(
            success=True,
            action="delete_row",
            message=f"Đã xóa {len(indices_to_delete)} dòng (còn lại {len(new_data)} dòng).",
            affected_rows=len(indices_to_delete),
            new_data=new_data,
            new_schema=schema,
        )
    
    # ===== CSV OPERATIONS =====
    
    async def _append_csv(
        self,
        data: list[dict],
        schema: list[dict],
        params: dict,
    ) -> ManipulationResult:
        """Thêm dữ liệu từ CSV vào cuối"""
        csv_data = params.get("csv_data", [])
        csv_schema = params.get("csv_schema", [])
        
        if not csv_data:
            return ManipulationResult(
                success=False,
                action="append_csv",
                message="Không có dữ liệu CSV để thêm.",
            )
        
        # Get existing columns
        existing_cols = set(col.get("name") for col in schema)
        
        # Detect new columns from CSV
        new_cols = []
        if csv_schema:
            for col in csv_schema:
                if col.get("name") not in existing_cols:
                    new_cols.append(col)
        else:
            # Detect from data
            csv_cols = set()
            for row in csv_data[:10]:
                csv_cols.update(row.keys())
            for col_name in csv_cols:
                if col_name not in existing_cols:
                    new_cols.append({"name": col_name, "data_type": "text"})
        
        # Merge data - align columns
        new_data = []
        for csv_row in csv_data:
            new_row = {}
            # Copy existing columns (empty for new rows)
            for col in schema:
                new_row[col.get("name")] = ""
            # Fill with CSV data
            for key, value in csv_row.items():
                new_row[key] = value
            new_data.append(new_row)
        
        # Update schema
        new_schema = schema + new_cols
        
        return ManipulationResult(
            success=True,
            action="append_csv",
            message=f"Đã thêm {len(csv_data)} dòng từ CSV." + 
                   (f" ({len(new_cols)} cột mới: {', '.join(c['name'] for c in new_cols)})" if new_cols else ""),
            affected_rows=len(csv_data),
            affected_columns=[col["name"] for col in new_cols],
            new_data=data + new_data,
            new_schema=new_schema,
        )
    
    async def _replace_csv(
        self,
        data: list[dict],
        schema: list[dict],
        params: dict,
    ) -> ManipulationResult:
        """Thay thế toàn bộ dữ liệu bằng CSV mới"""
        csv_data = params.get("csv_data", [])
        csv_schema = params.get("csv_schema", [])
        
        if not csv_data:
            return ManipulationResult(
                success=False,
                action="replace_csv",
                message="Không có dữ liệu CSV để thay thế.",
            )
        
        new_schema = csv_schema if csv_schema else self._detect_schema(csv_data)
        
        return ManipulationResult(
            success=True,
            action="replace_csv",
            message=f"Đã thay thế {len(data)} dòng cũ bằng {len(csv_data)} dòng mới từ CSV.",
            affected_rows=len(data),
            affected_columns=[col["name"] for col in schema],
            new_data=csv_data,
            new_schema=new_schema,
        )
    
    async def _merge_csv(
        self,
        data: list[dict],
        schema: list[dict],
        params: dict,
    ) -> ManipulationResult:
        """Gộp dữ liệu từ CSV - kết hợp columns từ cả 2 nguồn"""
        csv_data = params.get("csv_data", [])
        merge_key = params.get("merge_key", "")  # Column để join
        
        if not csv_data:
            return ManipulationResult(
                success=False,
                action="merge_csv",
                message="Không có dữ liệu CSV để gộp.",
            )
        
        # Get columns from both sources
        existing_cols = set(col.get("name") for col in schema)
        csv_cols = set()
        for row in csv_data[:10]:
            csv_cols.update(row.keys())
        
        all_cols = list(existing_cols | csv_cols)
        
        # Create lookup for CSV data
        csv_lookup = {}
        if merge_key:
            for row in csv_data:
                key = row.get(merge_key)
                if key:
                    csv_lookup[key] = row
        
        # Merge rows
        new_data = []
        for row in data:
            new_row = row.copy()
            merge_key_val = row.get(merge_key)
            
            if merge_key_val and merge_key_val in csv_lookup:
                # Merge values from CSV
                for col in csv_cols:
                    if col != merge_key and col not in existing_cols:
                        new_row[col] = csv_lookup[merge_key_val].get(col, "")
            
            new_data.append(new_row)
        
        # Add new columns to schema
        new_schema = schema.copy()
        for col_name in csv_cols:
            if col_name != merge_key and col_name not in existing_cols:
                new_schema.append({"name": col_name, "data_type": "text"})
        
        new_cols = [col["name"] for col in new_schema if col["name"] in csv_cols and col["name"] != merge_key]
        
        return ManipulationResult(
            success=True,
            action="merge_csv",
            message=f"Đã gộp {len(csv_data)} dòng từ CSV." +
                   (f" ({len(new_cols)} cột mới được thêm)" if new_cols else ""),
            affected_rows=len(data),
            affected_columns=new_cols,
            new_data=new_data,
            new_schema=new_schema,
        )
    
    # ===== DATA OPERATIONS =====
    
    async def _filter_data(
        self,
        data: list[dict],
        schema: list[dict],
        params: dict,
    ) -> ManipulationResult:
        """Lọc dữ liệu"""
        column = params.get("column", "")
        operator = params.get("operator", "equals")  # equals, greater, less, contains
        value = params.get("value", "")
        
        if not column:
            return ManipulationResult(
                success=False,
                action="filter_data",
                message="Cần chỉ định cột để lọc.",
            )
        
        filtered = []
        for row in data:
            cell_val = str(row.get(column, ""))
            
            if operator == "equals" and cell_val == str(value):
                filtered.append(row)
            elif operator == "contains" and str(value) in cell_val:
                filtered.append(row)
            elif operator == "greater" and self._parse_number(cell_val) > self._parse_number(str(value)):
                filtered.append(row)
            elif operator == "less" and self._parse_number(cell_val) < self._parse_number(str(value)):
                filtered.append(row)
        
        return ManipulationResult(
            success=True,
            action="filter_data",
            message=f"Đã lọc: {len(filtered)}/{len(data)} dòng thỏa điều kiện.",
            affected_rows=len(filtered),
            new_data=filtered,
            new_schema=schema,
        )
    
    async def _sort_data(
        self,
        data: list[dict],
        schema: list[dict],
        params: dict,
    ) -> ManipulationResult:
        """Sắp xếp dữ liệu"""
        column = params.get("column", "")
        direction = params.get("direction", "asc")  # asc, desc
        
        if not column:
            return ManipulationResult(
                success=False,
                action="sort_data",
                message="Cần chỉ định cột để sắp xếp.",
            )
        
        try:
            new_data = sorted(
                data,
                key=lambda x: self._parse_number(str(x.get(column, ""))) if direction == "desc" else self._parse_number(str(x.get(column, ""))),
                reverse=(direction == "desc"),
            )
        except Exception:
            # Fallback to string sort
            new_data = sorted(
                data,
                key=lambda x: str(x.get(column, "")),
                reverse=(direction == "desc"),
            )
        
        return ManipulationResult(
            success=True,
            action="sort_data",
            message=f"Đã sắp xếp theo cột '{column}' ({direction}).",
            affected_rows=len(new_data),
            new_data=new_data,
            new_schema=schema,
        )
    
    # ===== HELPER METHODS =====
    
    def _detect_column_type_from_formula(self, formula: str) -> str:
        """Detect column type từ formula"""
        formula_lower = formula.lower()
        
        # Math operations suggest number
        if any(op in formula_lower for op in ["+", "-", "*", "/", "sum", "avg", "count", "/"]):
            return "number"
        
        # Date patterns
        if any(pattern in formula_lower for pattern in ["date", "ngày", "tháng", "year"]):
            return "date"
        
        return "text"
    
    def _evaluate_formula(self, formula: str, row: dict, all_rows: list[dict]) -> Any:
        """Evaluate formula cho một row"""
        try:
            # Replace column references with values
            expr = formula
            
            # Simple column reference: {column_name}
            for col, val in row.items():
                expr = expr.replace(f"{{{col}}}", str(val))
                expr = expr.replace(f"{{{col.lower()}}}", str(val))
            
            # Common operations
            expr_lower = expr.lower()
            
            # SUM(column) - sum of column
            sum_match = re.search(r"sum\s*\(\s*(\w+)\s*\)", expr_lower)
            if sum_match:
                col_name = sum_match.group(1)
                return sum(self._parse_number(r.get(col_name, 0)) or 0 for r in all_rows)
            
            # AVG(column) - average of column
            avg_match = re.search(r"avg\s*\(\s*(\w+)\s*\)", expr_lower)
            if avg_match:
                col_name = avg_match.group(1)
                vals = [self._parse_number(r.get(col_name, 0)) for r in all_rows if self._parse_number(r.get(col_name, 0))]
                return sum(vals) / len(vals) if vals else 0
            
            # COUNT() - count rows
            if "count()" in expr_lower:
                return len(all_rows)
            
            # Division: a / b (calculate ratio)
            if "/" in expr and "sum(" not in expr_lower:
                parts = expr.split("/")
                if len(parts) == 2:
                    num = self._parse_number(parts[0]) or 0
                    denom = self._parse_number(parts[1]) or 1
                    if denom != 0:
                        return round(num / denom, 2)
            
            # Simple math expression
            if re.match(r"^[\d\s+\-*/().]+$", expr):
                return eval(expr)
            
            return expr
            
        except Exception:
            return formula
    
    def _parse_number(self, value: Any) -> float | None:
        """Parse giá trị thành số"""
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            cleaned = re.sub(r"[^\d.,]", "", value)
            if not cleaned:
                return None
            cleaned = cleaned.replace(",", ".")
            try:
                return float(cleaned)
            except ValueError:
                return None
        return None
    
    def _detect_schema(self, data: list[dict]) -> list[dict]:
        """Detect schema từ data"""
        if not data:
            return []
        
        schema = []
        for col_name in data[0].keys():
            sample_value = data[0].get(col_name, "")
            
            # Detect type from sample
            if self._parse_number(sample_value) is not None:
                col_type = "number"
            elif re.match(r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}", str(sample_value)):
                col_type = "date"
            else:
                col_type = "text"
            
            schema.append({
                "name": col_name,
                "data_type": col_type,
            })
        
        return schema


# Helper function để format result cho API response
def format_manipulation_result(result: ManipulationResult) -> dict:
    """Format ManipulationResult thành dict cho API"""
    return {
        "success": result.success,
        "action": result.action,
        "message": result.message,
        "affected_rows": result.affected_rows,
        "affected_columns": result.affected_columns,
        "data_preview": result.new_data[:5] if result.new_data else None,
        "schema": result.new_schema,
        "error": result.error,
    }
