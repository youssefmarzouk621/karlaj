# mosaic-generator (FastAPI). Build context: this folder.
#   docker build -t brickart/mosaic-generator mosaic-generator

ARG PYTHON_VERSION=3.12

# ---------------------------------------------------------------------------
# Build: install wheels into a virtualenv that the runtime stage copies as-is.
FROM python:${PYTHON_VERSION}-slim AS builder
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1
RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# ---------------------------------------------------------------------------
FROM python:${PYTHON_VERSION}-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH=/opt/venv/bin:$PATH
RUN useradd --system --uid 10001 --no-create-home app
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY *.py *.csv ./

USER app
EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8002/docs', timeout=4)"

# One worker on purpose: generated jobs (for GET /pdf/{job_id}) live in memory.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002", "--proxy-headers"]
