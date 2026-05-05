FROM python:3.12-slim

RUN set -eux; \
    sed -i 's@http://deb.debian.org/debian@https://mirrors.tuna.tsinghua.edu.cn/debian@g' /etc/apt/sources.list.d/debian.sources; \
    sed -i 's@http://security.debian.org/debian-security@https://mirrors.tuna.tsinghua.edu.cn/debian-security@g' /etc/apt/sources.list.d/debian.sources; \
    apt-get update -o Acquire::Retries=5; \
    apt-get install -y --no-install-recommends -o Acquire::Retries=5 ffmpeg; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --retries 5 --timeout 120 -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
