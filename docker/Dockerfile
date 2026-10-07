# Sandbox image: one container per untrusted agent. Build from the repo root:
#   python -m build --wheel && docker build -f docker/Dockerfile -t papersseum-sandbox .
#   (CPU torch for agents that ship .pt weights: add --build-arg TORCH=1; +~1 GB)
FROM python:3.11-slim

# Pinned so every worker produces identical replays; keep in sync with the
# numpy_version recorded in replay headers.
ARG NUMPY_VERSION=2.5.1
ARG TORCH=0

RUN pip install --no-cache-dir numpy==${NUMPY_VERSION}
COPY dist/papersseum-*.whl /tmp/
RUN pip install --no-cache-dir /tmp/papersseum-*.whl && rm /tmp/papersseum-*.whl
RUN if [ "$TORCH" = "1" ]; then \
      pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu; fi

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PYTHONHASHSEED=0 \
    OMP_NUM_THREADS=1 MKL_NUM_THREADS=1
USER 65534:65534
WORKDIR /tmp
ENTRYPOINT ["python", "-m", "papersseum.sandbox.host"]
