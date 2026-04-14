# F11 Test Plan - Insight Copilot A2A

## Functional test
- Upload file CSV mau -> preview dung du lieu -> phan tich thanh cong.
- Upload file Excel 1 sheet -> parse dung cot -> phan tich thanh cong.
- Xem ket qua run cu va phan tich lai.

## Data quality test
- File thieu cot `orders` -> hien limitations ve conversion.
- File thieu `ad_spend` -> ROAS va canh bao phu hop.
- File du lieu < 20 dong -> canh bao do tin cay.

## Reliability test
- Tat Qwen endpoint -> fallback GPT hoat dong, user_message than thien.
- Tat DeepSeek endpoint -> map fallback heuristic va trace fail duoc luu.

## UX test
- Overlay pipeline hien dung step/model/%.
- Vong tron data quality hien thi dung %.
- Bang preview va bang runs khong vo layout khi du lieu dai.
