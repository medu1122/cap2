# Insight Copilot - AI Quality Framework (Qwen)

## 1) Muc tieu chat luong
Dam bao cau phan tich va khuyen nghi cua Qwen:
- dung su that du lieu,
- huu dung cho van hanh SMB,
- co the hanh dong ngay,
- giong van phong kinh doanh ro rang, khong khoa truong.

## 2) Nguyen tac cot loi
1. Facts-first: Qwen chi duoc suy luan tu metric/rule da tinh.
2. No-evidence-no-claim: khong co bang chung thi khong ket luan.
3. Action-oriented: moi insight phai co action tiep theo.
4. Calibrated confidence: diem tu tin phu thuoc data quality + signal strength.

## 3) Prompt stack 3 lop
### Lop A - System policy (bat buoc)
- Vai tro: Senior marketing analyst cho SMB.
- Gioi han: khong du doan vo can cu, khong viet qua output contract.
- Tone: ngan gon, uu tien tac dong kinh doanh.

### Lop B - Domain context
- Thong tin doanh nghiep: nganh, gia tri don hang, kenh chinh, ngan sach.
- Dinh nghia metric: ROAS, CAC, CVR, repeat rate, etc.
- Rule hits: anomaly/opportunity da duoc machine layer phat hien.

### Lop C - Task instruction
- Sinh toi da N insight theo uu tien.
- Moi insight bat buoc co evidence, root-cause hypothesis, recommended actions.
- Uu tien action co impact cao, effort hop ly.

## 4) Output contract JSON (bat buoc)
```json
{
  "summary": "string",
  "insights": [
    {
      "title": "string",
      "priority": "P1|P2|P3",
      "confidence": 0.0,
      "evidence": [
        {
          "metric_key": "roas_7d",
          "metric_value": 1.8,
          "baseline_value": 2.4,
          "window": "7d"
        }
      ],
      "reasoning": "string",
      "actions": [
        {
          "action_text": "string",
          "owner": "marketing|content|sales|ops",
          "eta_days": 3,
          "impact_estimate": "low|medium|high"
        }
      ],
      "risk_if_ignored": "string"
    }
  ],
  "data_warnings": ["string"]
}
```

## 5) Guardrails
- Validate JSON schema truoc khi luu/tra UI.
- Reject response neu:
  - confidence ngoai [0,1],
  - evidence rong,
  - metric_key khong ton tai trong metric dictionary,
  - action khong ro owner hoac eta.
- Bat buoc `data_warnings` neu data coverage thap hon nguong.

## 6) Confidence calibration
Cong thuc goi y:
- `confidence = 0.5 * data_completeness + 0.3 * signal_strength + 0.2 * consistency_score`

Trong do:
- `data_completeness`: ti le truong du lieu co gia tri.
- `signal_strength`: muc lech so voi baseline.
- `consistency_score`: do on dinh cua xu huong trong 2-4 chu ky.

## 7) Evaluation rubric (offline va canary)
Cham theo thang 1-5 cho moi tieu chi:
- Factuality: ket luan co dung metric khong.
- Business usefulness: co giup quyet dinh ngay khong.
- Actionability: action co owner, ETA, impact khong.
- Clarity: de doc cho chu doanh nghiep khong ky thuat.
- Safety: co khang dinh qua muc khi data yeu khong.

Dieu kien pass release:
- Diem trung binh moi tieu chi >= 4.0.
- Ty le schema pass >= 99%.
- Ty le insight bi danh gia "khong huu ich" < 15% trong canary.

## 8) Vong lap cai tien lien tuc
- Thu thap feedback explicit tu nut "Huu ich/Khong huu ich".
- Luu bo prompt regression set theo nganh SMB pho bien.
- Moi lan cap nhat prompt/rules phai chay lai eval set truoc khi rollout 100%.

## 9) Khuyen nghi van hanh voi Qwen
- Dung nhiet do thap (`temperature` 0.1-0.3) cho insight chuan hoa.
- Tach role: Qwen cho reasoning narrative, metric/rules de code xu ly.
- Co fallback route khi timeout, nhung giu cung output contract.
