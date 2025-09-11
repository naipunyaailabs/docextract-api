from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from pdf2image import convert_from_bytes
import tempfile
import os
from typing import List
from PIL import Image

app = FastAPI()

@app.post('/convert')
def convert_pdf(file: UploadFile = File(...)):
    # Save PDF to temp file
    pdf_bytes = file.file.read()
    with tempfile.TemporaryDirectory() as tmpdir:
        images = convert_from_bytes(pdf_bytes, dpi=300, fmt='png')
        image_paths: List[str] = []
        for i, img in enumerate(images):
            out_path = os.path.join(tmpdir, f'page_{i+1}.png')
            img.save(out_path, format='PNG')
            with open(out_path, 'rb') as f:
                img_base64 = 'data:image/png;base64,' + f.read().encode('base64').decode('utf-8')
            image_paths.append(img_base64)
        return JSONResponse(content={"images": image_paths})