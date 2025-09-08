# simulator/Dockerfile
FROM python:3.10-slim

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

WORKDIR /app
COPY publisher.py .

#-u for <4KiB messages, immediate flush
CMD ["python", "-u", "publisher.py"]