from flask import Flask, request, jsonify, render_template
import os

# cargas de terceros con comprobaciones para errores comprensibles
try:
    import google.generativeai as genai
except ImportError:
    print(" ERROR: Falta el paquete 'google-generativeai'. Instala con 'pip install google-generativeai'")
    exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print(" ERROR: Falta el paquete 'python-dotenv'. Instala con 'pip install python-dotenv'")
    exit(1)

try:
    from PIL import Image
except ImportError:
    print(" ERROR: Falta el paquete 'Pillow'. Instala con 'pip install pillow'")
    exit(1)

import uuid
import io
import mimetypes

load_dotenv()

app = Flask(__name__)

# Configurar Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    print(" ERROR: No hay API key en .env")
    exit(1)

try:
    genai.configure(api_key=GEMINI_API_KEY)
    
    # Buscar modelo disponible
    print("\n Buscando modelos disponibles...")
    models = genai.list_models()
    
    model = None
    for m in models:
        if 'generateContent' in m.supported_generation_methods:
            try:
                print(f"  Probando: {m.name}")
                test_model = genai.GenerativeModel(m.name)
                test_response = test_model.generate_content("hola", generation_config={"max_output_tokens": 1})
                print(f"   {m.name} FUNCIONA!")
                model = test_model
                break
            except:
                continue
    
    if not model:
        print(" ERROR: No se encontró modelo disponible")
        exit(1)
    
    print(f"\n Usando modelo: {model.model_name}")
    
except Exception as e:
    print(f" ERROR: {e}")
    exit(1)

# Configurar carpeta temporal
UPLOAD_FOLDER = 'temp_uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def get_file_metadata(file):
    """Obtener metadatos del archivo"""
    filename = str(uuid.uuid4()) + '_' + file.filename
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    size = os.path.getsize(filepath)
    mime_type = mimetypes.guess_type(file.filename)[0] or 'application/octet-stream'
    
    os.remove(filepath)
    
    # Formatear tamaño
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            tamaño_formateado = f"{size:.1f} {unit}"
            break
        size /= 1024.0
    
    return {
        'nombre': file.filename,
        'tipo': mime_type,
        'tamaño_formateado': tamaño_formateado
    }

def process_image(file):
    """Procesar imagen"""
    try:
        image_data = file.read()
        return Image.open(io.BytesIO(image_data))
    except:
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/test')
def test():
    return jsonify({
        'status': 'ok',
        'message': 'Servidor funcionando',
        'modelo': model.model_name
    })

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        message = request.form.get('message', '')
        files = request.files.getlist('files')
        
        file_metadata = []
        images = []
        
        # Procesar archivos
        if files and files[0].filename:
            for file in files:
                metadata = get_file_metadata(file)
                file_metadata.append(metadata)
                
                if metadata['tipo'].startswith('image/'):
                    file.seek(0)
                    img = process_image(file)
                    if img:
                        images.append(img)
        
        # Generar respuesta
        if images:
            response = model.generate_content([message] + images)
        else:
            response = model.generate_content(message)
        
        return jsonify({
            'success': True,
            'response': response.text,
            'files': file_metadata if file_metadata else None
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print(" Servidor iniciado!")
    print(" Abre: http://localhost:5000")
    print("="*60 + "\n")
    app.run(debug=True, port=5000)