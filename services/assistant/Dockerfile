FROM python:3.12-slim AS dependencies
WORKDIR /build
COPY requirements.lock .
RUN pip install --no-cache-dir --prefix=/install -r requirements.lock
FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 SONORAN_STAGE=scaffold
RUN useradd --uid 10001 --create-home app
COPY --from=dependencies /install /usr/local
COPY services/__init__.py services/__init__.py
COPY services/common services/common
COPY services/assistant services/assistant
COPY packages/contracts packages/contracts
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=3)"
CMD ["python", "-m", "uvicorn", "services.assistant.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
