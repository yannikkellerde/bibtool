import {setCookie, getCookie} from "./helpers.js"
var cur_selection = -1;
var hides = ["addbox","buttonwrapper"];
var elems_hidden = false;
var cur_data = {};
const tbody = document.getElementById("table_body");
const stat_msg_box = document.getElementById("status_msg");
var wait_for = 0;
function xml_http_post(url, data, callback) {
    const req = new XMLHttpRequest();
    req.open("POST", url, true);
    req.setRequestHeader("Content-Type", "application/json");
    req.onreadystatechange = function() {
        if (this.readyState == 4) {
            callback(JSON.parse(this.responseText));
        }
    }
    req.send(JSON.stringify(data));
}
function delete_selection(){
	if (cur_selection>=0){
		xml_http_post(window.location.href,{"delete":cur_selection,"password":document.getElementById("password").value},handle_return_data);
		deselect_entry();
	}
}
function request_citation(){
	if (cur_selection>=0){
		xml_http_post(window.location.href,{"citeme":cur_selection,"password":document.getElementById("password").value},handle_return_data)
	}
}
function request_pdf(){
	if (cur_selection>=0){
		xml_http_post(window.location.href,{"request_pdf":cur_selection,"password":document.getElementById("password").value},handle_return_data)
	}
}
function display_status_msg(msg){
	stat_msg_box.innerText=msg;
	clearTimeout(wait_for);
	wait_for = setTimeout(remove_status_msg,3000);
}
function remove_status_msg(){
	stat_msg_box.innerHTML="";
}
function fillin_edit_fields(){
	if (cur_selection>=0){
		document.getElementById("add_title").value = cur_data[cur_selection]["title"];
		document.getElementById("add_doi").value = cur_data[cur_selection]["doi"];
		document.getElementById("add_tags").value = cur_data[cur_selection]["tags"];
		document.getElementById("add_id").value = cur_selection;
	}
}
function hide_elems(){
	if (!elems_hidden){
		for (const tohide of hides){
			document.getElementById(tohide).style.visibility = "hidden";
		}
		elems_hidden = true;
	}
}
function show_elems(){
	if (elems_hidden){
		for (const tohide of hides){
			document.getElementById(tohide).style.visibility = "visible";
		}
		elems_hidden = false;
	}
}
function show_rows(row_data){
	tbody.innerHTML = "";
	cur_data = row_data;
	Object.entries(row_data).forEach(([id, info]) => {
		let tr = tbody.appendChild(document.createElement("tr"));
		tr.addEventListener("mousedown",function(e){select_entry(parseInt(this.id.split("_")[1]))});
		tr.id = "tr_"+id;
		let td = tr.appendChild(document.createElement("td"));
		td.innerText = id;
		td = tr.appendChild(document.createElement("td"));
		td.innerText = info.title;
		td = tr.appendChild(document.createElement("td"));
		let a = td.appendChild(document.createElement("a"));
		a.innerText = info.doi;
		a.href = "https://doi.org/"+info.doi;
		td = tr.appendChild(document.createElement("td"));
		td.innerText = info.tags;
		td = tr.appendChild(document.createElement("td"));
		td.innerText = info.date;
	});
	deselect_entry();
}

function handle_return_data(data){
	if ("entries" in data){
		show_rows(data["entries"]);
	}
	if ("error" in data){
		display_status_msg(data["error"])
	}
	if ("success" in data && data.success){
		display_status_msg("success");
		setCookie("password",document.getElementById("password").value,100);
	}
	if ("citation" in data){
		navigator.clipboard.writeText(data["citation"]).then(() => {
			display_status_msg("Citation copied to clipboard");
		},() => {
			display_status_msg("Browser rejected copy to clipboard");
    		});
	}
	if ("pdf_path" in data){
		window.open(data["pdf_path"],"_blank")
	}
}

function select_entry(idx){
	if (cur_selection>=0){
		document.getElementById("tr_"+cur_selection).className="";
	}
	cur_selection = idx;
	document.getElementById("tr_"+idx).className="selected";
	document.getElementById("delete").className="button6";
	document.getElementById("edit").className="button6";
	document.getElementById("open_PDF").className="button6";
	document.getElementById("cite").className="button6";
}

function deselect_entry(){
	if (cur_selection>=0){
		document.getElementById("tr_"+cur_selection).className="";
	}
	cur_selection = -1;
	document.getElementById("delete").className="button6 disabled";
	document.getElementById("edit").className="button6 disabled";
	document.getElementById("open_PDF").className="button6 disabled";
	document.getElementById("cite").className="button6 disabled";
}

function fileupload(){
	if (cur_selection>=0){
		var input = document.createElement('input');
		input.type = 'file';
		input.addEventListener("change",function(e){
			let pdf = this.files[0];
			let formData = new FormData();
			formData.append("pdf", pdf);
			formData.append("password",document.getElementById("password").value)
			formData.append("id",cur_selection)
			fetch(window.location.href, {method: "POST", body: formData});
		})
		input.click();
	}
}

document.getElementById("show_last_form").addEventListener("submit",
	function(e){
		e.preventDefault();
		xml_http_post(window.location.href,{"last_modified":true,"amount":document.getElementById("newest_n").value},handle_return_data);
	}
)

document.getElementById("searchbox").addEventListener("submit",
	function(e){
		e.preventDefault();
		let dic = {"search":true}
		for (const id of ["title","doi","tags","date"]){
			let tex = document.getElementById(id).value;
			if (tex){
				dic[id] = tex.split(":");
			}
		}
		xml_http_post(window.location.href,dic,handle_return_data)
	}
)
document.getElementById("addbox").addEventListener("submit",
	function(e){
		e.preventDefault();
		let dic = {"newentry":true,"password":document.getElementById("password").value}
		for (const id of ["id","title","doi","tags"]){
			let tex = document.getElementById("add_"+id).value;
			if (tex){
				dic[id] = tex;
			}
		}
		xml_http_post(window.location.href,dic,handle_return_data);
	}
)

document.getElementById("delete").addEventListener("click",delete_selection);
document.getElementById("password").addEventListener("keydown",show_elems);
document.getElementById("edit").addEventListener("click",fillin_edit_fields);
document.getElementById("cite").addEventListener("click",request_citation);
document.getElementById("open_PDF").addEventListener("click",request_pdf);

document.addEventListener("keydown",function(e){
	if (e.key=="c"){
		request_citation();
	}
	else if (e.key=="d"){
		delete_selection();
	}
	else if (e.key=="e"){
		fillin_edit_fields();
	}
	else if (e.key=="u"){
		fileupload();
	}
	else if (e.key=="o"){
		request_pdf();
	}
	else if (e.key=="ArrowDown"){
		if (cur_selection<Object.keys(cur_data).length-1){
			select_entry(cur_selection+1);
		}
	}
	else if (e.key=="ArrowUp"){
		if (cur_selection>0){
			select_entry(cur_selection-1);
		}
	}
})


xml_http_post(window.location.href,{"last_modified":true},handle_return_data);
var pw_cookie = getCookie("password");
if (pw_cookie){
	document.getElementById("password").value = pw_cookie;
}
else{
	hide_elems();
}
