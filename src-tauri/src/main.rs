#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::net::TcpListener;
use std::io::{Read, Write};
use std::thread;

#[tauri::command]
fn gmail_start_server(window: tauri::Window) {
  thread::spawn(move || {
    let listener = TcpListener::bind("127.0.0.1:3000").unwrap_or_else(|_| {
      TcpListener::bind("127.0.0.1:3001").unwrap()
    });
    
    for stream in listener.incoming() {
      match stream {
        Ok(mut stream) => {
          let mut buffer = [0; 4096];
          stream.read(&mut buffer).unwrap_or(0);
          let request = String::from_utf8_lossy(&buffer);
          
          if let Some(code_start) = request.find("code=") {
            let code_part = &request[code_start + 5..];
            let code_end = code_part.find(|c: char| c == '&' || c == ' ' || c == '\r').unwrap_or(code_part.len());
            let code = &code_part[..code_end];
            
            let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body style='background:#05020f;color:#00d2ff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><div style='text-align:center'><h2>ALAN AI conectado a Gmail</h2><p>Puedes cerrar esta ventana.</p></div></body></html>";
            stream.write_all(response.as_bytes()).unwrap_or(());
            
            window.emit("gmail-auth-code", code.to_string()).unwrap_or(());
            break;
          }
        }
        Err(_) => break,
      }
    }
  });
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      let window = app.get_window("main").unwrap();
      #[cfg(target_os = "macos")]
      {
        window.with_webview(|webview| {
          #[cfg(target_os = "macos")]
          unsafe {
            use objc::*;
            let () = msg_send![webview.inner(), _setMediaCaptureEnabled: true];
          }
        }).ok();
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![gmail_start_server])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
