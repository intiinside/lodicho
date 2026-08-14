from fastapi import FastAPI

app = FastAPI(title="Lo Dicho API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
