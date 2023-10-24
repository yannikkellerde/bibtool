import re
import requests
from flask import jsonify, render_template
from werkzeug.utils import secure_filename
import os
import hashlib
import time
import pandas as pd
import numpy as np

class Biliograph_handler():
    def __init__(self) -> None:
        self.pdf_path = "pdfs"
        self.bib_path = "bib.csv"
        self.columns=["title","doi","tags","date"]
        self.additonal_columns=["citation","pdf_name"]
        self.bib_df = pd.DataFrame(columns=self.columns+self.additonal_columns)
        self.hashpw = "89369daf658aeb0f54bec4c36d1e40ed6647066a3d2f0d1c465293e52751e11e"
        self.read_bib_file()

    def read_bib_file(self):
        if os.path.exists(self.bib_path):
            self.bib_df = pd.read_csv(self.bib_path,index_col=0,parse_dates=["date"],infer_datetime_format=True)
            self.bib_df.reset_index(drop=True,inplace=True)

    def search_by_regex(self,res_by_col):
        sel_lines = []
        for colname,reg_strs in res_by_col.items():
            for reg_str in reg_strs:
                sel_lines.append(self.bib_df[colname].str.contains(reg_str))
        return self.bib_df[self.columns][np.logical_or.reduce(sel_lines)].to_dict(orient="index")

    def show_last_modified(self,amount):
        self.bib_df.sort_values(by=["date"],inplace=True,ascending=False)
        return self.bib_df[self.columns].head(amount).to_dict(orient="index")

    def change_bib_entry(self,index,title,tags,doi):
        self.bib_df.loc[index] = {"title":title,"tags":tags,"doi":doi,"date":pd.Timestamp.now()}
        self.bib_df.to_csv(self.bib_path)

    def delete_entry(self,index):
        self.bib_df = self.bib_df.drop(index)
        self.bib_df.reset_index(drop=True,inplace=True)
        self.bib_df.to_csv(self.bib_path)

    def validate_pw(self,pw):
        return hashlib.sha256(pw.encode()).hexdigest()==self.hashpw

    def get_citation(self,id,doi=None,tags=""):
        citat = None
        if id < len(self.bib_df):
            citat = self.bib_df.loc[id]["citation"]
            doi = self.bib_df.loc[id]["doi"]
        if type(citat)!=str:
            r = requests.get("https://citation.crosscite.org/format",params={
                "doi":doi,
                "lang":"en-US",
                "style":"bibtex"
            },timeout=2)
            if r.status_code==200:
                citat = r.content.decode().strip().replace("\n","")
                if "DOI not found" in citat:
                    raise Exception("DOI not found")
                if id<len(self.bib_df):
                    self.bib_df.at[id,"citation"] = citat
                    self.bib_df.to_csv(self.bib_path)
            else:
                raise Exception("Failed to get citation "+str(r))
        if id>=len(self.bib_df):
            self.bib_df.loc[id] = {"title":re.search(r"title=\{([^\}]+)\}, ",citat).groups(1)[0],"tags":tags,"doi":doi,"date":pd.Timestamp.now(),"citation":citat}
            self.bib_df.to_csv(self.bib_path)
        return citat

    def file_upload(self,file,id,password):
        return_data = {}
        if self.validate_pw(password):
            if '.' and file.filename.rsplit('.',1)[1].lower()=="pdf":
                sfname = secure_filename(file.filename)
                pdf_name = self.bib_df.loc[id]["pdf_name"]
                if type(pdf_name)==str and os.path.exists(os.path.join(self.pdf_path,pdf_name)):
                    os.remove(os.path.join(self.pdf_path,pdf_name))
                file.save(os.path.join(self.pdf_path, sfname))
                self.bib_df.at[id,"pdf_name"] = sfname
                self.bib_df.to_csv(self.bib_path)
                return_data["success"] = True
            else:
                return_data["error"] = "Invalid file ending"
        else:
            return_data["error"] = "Invalid password"
        return jsonify(return_data)

    def do_GET(self):
        return render_template("frontend.html")

    def do_POST(self,data):
        return_data = {}
        if "search" in data:
            return_data["entries"] = self.search_by_regex({col:data[col] for col in self.columns if col in data})
        elif "last_modified" in data:
            return_data["entries"] = self.show_last_modified(int(data["amount"]) if "amount" in data else 10);
        elif "newentry" in data:
            return_data["success"] = False
            if "password" in data and self.validate_pw(data["password"]):
                for c in ("tags","doi"):
                    if not c in data:
                        return_data["error"] = f"Missing {c}"
                        break
                else:
                    if not "title" in data:
                        try:
                            self.get_citation(len(self.bib_df),data["doi"],data["tags"])
                        except Exception as e:
                            return_data["error"] = str(e)
                    else:
                        self.change_bib_entry(int(data["id"]) if "id" in data else len(self.bib_df),data["title"],data["tags"],data["doi"])
                    return_data["success"] = True
                    return_data["entries"] = self.show_last_modified(10)
            else:
                return_data["error"] = "Invalid Password"
        elif "delete" in data:
            return_data["success"] = False
            if "password" in data and self.validate_pw(data["password"]):
                self.delete_entry(index=data["delete"])
                return_data["success"] = True
                return_data["entries"] = self.show_last_modified(10)
            else:
                return_data["error"] = "Invalid Password"
        elif "citeme" in data:
            if type(self.bib_df.loc[data["citeme"]]["citation"])==str or ("password" in data and self.validate_pw(data["password"])):
                try:
                    return_data["citation"] = self.get_citation(data["citeme"])
                except Exception as e:
                    return_data["error"] = str(e)
            else:
                return_data["error"] = "No citation available"
        elif "request_pdf" in data:
            if "password" in data and self.validate_pw(data["password"]):
                pdf = self.bib_df.loc[data["request_pdf"]]["pdf_name"]
                if type(pdf)==str:
                    return_data["success"] = True
                    return_data["pdf_path"] = os.path.join(self.pdf_path,pdf)
                else:
                    return_data["error"] = "No pdf available"
            else:
                return_data["error"] = "Invalid Password"
            

        return jsonify(return_data)
