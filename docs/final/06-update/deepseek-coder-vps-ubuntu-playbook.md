# Playbook cai DeepSeek Coder 6.7B tren VPS Ubuntu

## 1) Yeu cau toi thieu
- Ubuntu 22.04 LTS
- RAM: >= 16GB (khuyen nghi 32GB)
- GPU: >= 12GB VRAM neu muon response nhanh
- Disk trong: >= 40GB
- Mo port noi bo cho model server (vd `11434` hoac `8002`)

## 2) Cai dat nhanh voi Ollama
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
```

Pull model:
```bash
ollama pull deepseek-coder:6.7b
ollama pull qwen2.5:7b
```

Test:
```bash
curl http://127.0.0.1:11434/api/generate -d '{"model":"deepseek-coder:6.7b","prompt":"hello","stream":false}'
```

## 3) Bien moi truong cho project
```env
DEEPSEEK_BASE_URL=http://<vps-ip>:11434/v1
DEEPSEEK_MODEL=deepseek-coder:6.7b
QWEN_BASE_URL=http://<vps-ip>:11434/v1
QWEN_MODEL=qwen2.5:7b
OPENAI_API_KEY=...
```

## 4) Bao mat co ban
- Dat reverse proxy (Nginx/Caddy) + basic auth/token.
- Gioi han IP allowlist (chi API server duoc goi).
- Khong expose cong khai khong auth.

## 5) Healthcheck va benchmark nhe
Healthcheck:
```bash
curl -s http://127.0.0.1:11434/api/tags
```

Benchmark nhanh:
```bash
time curl -s http://127.0.0.1:11434/api/generate -d '{"model":"deepseek-coder:6.7b","prompt":"classify csv columns","stream":false}'
```

## 6) Troubleshoot pho bien
- **OOM**: giam context length, dung quantized model.
- **Timeout**: tang timeout API + route fallback GPT.
- **Khong pull duoc model**: kiem tra disk/network DNS.
- **Response cham**: uu tien GPU, giam parallel requests.
