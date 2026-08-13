"""RAW 근태 데이터 + (선택) 월 최대근로시간 기준시트를 받아 7종 규칙 전체를 돌리고 결과를 저장한다.

사용 예:
  python3 scripts/run_analysis.py "../26.06월_유연근무 현황관리_더미.xlsx" --out output/result.csv
  python3 scripts/run_analysis.py "../26.06월_유연근무 현황관리_더미.xlsx" \
      --threshold-sheet "월별_최대근로시간_기준.xlsx" --out output/result.csv
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from attendance.load import load_monthly_max_hours_threshold, load_raw
from attendance import rules


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("xlsx_path", help="근태 RAW 데이터 xlsx 경로")
    parser.add_argument(
        "--threshold-sheet",
        default=None,
        help="월 최대근로시간 기준 시트 경로(없으면 규칙1은 건너뜀)",
    )
    parser.add_argument("--out", default=None, help="결과 CSV 저장 경로")
    args = parser.parse_args()

    print("RAW 데이터 로딩 중...")
    df = load_raw(args.xlsx_path)
    print(f"로드 완료: {len(df)}행, {df['사번'].nunique()}명\n")

    threshold_lookup = None
    if args.threshold_sheet:
        print(f"월 최대근로시간 기준시트 로딩: {args.threshold_sheet}")
        threshold_lookup = load_monthly_max_hours_threshold(args.threshold_sheet, base_df=df)
        print(f"기준시간 매핑된 인원: {len(threshold_lookup)}명\n")
    else:
        print("기준시트 미지정 -> 규칙1(월 최대근로시간 초과)은 결과에서 빈 값으로 처리됩니다.\n")

    result = rules.run_all_rules(df, rule1_threshold_lookup=threshold_lookup)

    print(f"총 특이건: {len(result)}건 / 특이 인원(중복포함규칙별): {result['사번'].nunique()}명\n")
    print("규칙별 건수:")
    print(result["rule_code"].value_counts().to_string())

    if args.out:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        result.to_csv(args.out, index=False, encoding="utf-8-sig")
        print(f"\n결과 저장: {args.out}")


if __name__ == "__main__":
    main()
