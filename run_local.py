import uvicorn

if __name__ == "__main__":
    print("Starting IceBel Contracts Web App on http://127.0.0.1:8000 ...")
    uvicorn.run("api.index:app", host="127.0.0.1", port=8000, reload=True)
