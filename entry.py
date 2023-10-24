from flask import send_from_directory, Flask, request
from backend import Biliograph_handler

bib_handler = Biliograph_handler()
app = Flask(__name__)

@app.route("/",methods=["GET","POST"])
def bibiliography_tool():
    if request.method == "GET":
        return bib_handler.do_GET()
    elif request.method == "POST":
        print("received POST,",request.files,request.files.keys(),request,vars(request))
        if 'pdf' in request.files and request.files['pdf'].filename:
            return bib_handler.file_upload(request.files['pdf'],int(request.form["id"]),request.form["password"])
        else:
            return bib_handler.do_POST(request.json)
    else:
        return "invalid"

@app.route('/styles/<path:path>')
def send_style(path):
    return send_from_directory('styles', path)

@app.route('/js/<path:path>')
def send_js(path):
    return send_from_directory('js', path)

@app.route('/pdfs/<path:path>')
def send_pdf(path):
    return send_from_directory('pdfs', path)


@app.route('/bib.csv')
def send_bib():
    return send_from_directory('.','bib.csv')
