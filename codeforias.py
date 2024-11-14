import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
from github import Github
import base64
import os
from datetime import datetime
from ttkthemes import ThemedTk

class ModernButton(tk.Button):
    def __init__(self, master=None, **kwargs):
        super().__init__(master, **kwargs)
        self.config(
            bg="#007AFF",
            fg="white",
            relief="flat",
            bd=0,
            padx=20,
            pady=10,
            font=("SF Pro Text", 12),
            activebackground="#0051CD",
            activeforeground="white"
        )
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)

    def on_enter(self, e):
        self['background'] = "#0051CD"

    def on_leave(self, e):
        self['background'] = "#007AFF"

class CodeForiasGUI:
    def __init__(self):
        self.root = ThemedTk(theme="arc")
        self.root.title("CodeForias")
        self.root.geometry("800x700")
        self.root.configure(bg="white")
        
        self.setup_styles()
        self.create_widgets()
        
    def setup_styles(self):
        self.colors = {
            "bg": "white",
            "primary": "#007AFF",
            "secondary": "#F2F2F7",
            "text": "#000000",
            "border": "#E5E5EA"
        }
        
        style = ttk.Style()
        style.configure("Card.TFrame",
                       background=self.colors["bg"],
                       relief="flat")
        
        style.configure("Title.TLabel",
                       background=self.colors["bg"],
                       font=("SF Pro Display", 28, "bold"),
                       foreground=self.colors["text"])
        
        style.configure("Subtitle.TLabel",
                       background=self.colors["bg"],
                       font=("SF Pro Text", 14),
                       foreground="#666666")
                       
        style.configure("Input.TEntry",
                       fieldbackground=self.colors["secondary"],
                       borderwidth=0,
                       font=("SF Pro Text", 12))

    def create_widgets(self):
        # Main container
        main = ttk.Frame(self.root, style="Card.TFrame")
        main.pack(fill=tk.BOTH, expand=True, padx=30, pady=20)
        
        # Header
        header = ttk.Frame(main, style="Card.TFrame")
        header.pack(fill=tk.X, pady=(0, 30))
        
        ttk.Label(header,
                 text="CodeForias",
                 style="Title.TLabel").pack()
                 
        ttk.Label(header,
                 text="Exportador de Repositorios GitHub",
                 style="Subtitle.TLabel").pack(pady=(5,0))
        
        # Input container
        input_container = ttk.Frame(main, style="Card.TFrame")
        input_container.pack(fill=tk.X, pady=10)
        
        # Repository URL
        ttk.Label(input_container,
                 text="URL del Repositorio",
                 font=("SF Pro Text", 12, "bold"),
                 background=self.colors["bg"]).pack(anchor="w")
                 
        self.url_entry = ttk.Entry(
            input_container,
            style="Input.TEntry",
            font=("SF Pro Text", 12)
        )
        self.url_entry.pack(fill=tk.X, pady=(5, 15))
        
        # GitHub Token
        ttk.Label(input_container,
                 text="Token GitHub (opcional)",
                 font=("SF Pro Text", 12, "bold"),
                 background=self.colors["bg"]).pack(anchor="w")
                 
        self.token_entry = ttk.Entry(
            input_container,
            style="Input.TEntry",
            font=("SF Pro Text", 12),
            show="•"
        )
        self.token_entry.pack(fill=tk.X, pady=(5, 20))
        
        # Export button
        self.export_button = ModernButton(
            input_container,
            text="Exportar Repositorio",
            command=self.export_repo
        )
        self.export_button.pack(pady=10)
        
        # Log area
        log_container = ttk.Frame(main, style="Card.TFrame")
        log_container.pack(fill=tk.BOTH, expand=True, pady=(20, 0))
        
        ttk.Label(log_container,
                 text="Estado de la Exportación",
                 font=("SF Pro Text", 12, "bold"),
                 background=self.colors["bg"]).pack(anchor="w")
        
        self.log_text = scrolledtext.ScrolledText(
            log_container,
            height=15,
            font=("SF Pro Text", 11),
            bg=self.colors["secondary"],
            relief="flat",
            padx=10,
            pady=10
        )
        self.log_text.pack(fill=tk.BOTH, expand=True, pady=(5, 0))

    def log_status(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
        self.log_text.see(tk.END)
        self.root.update()

    def export_repo(self):
        url = self.url_entry.get().strip()
        token = self.token_entry.get().strip()
        
        if not url:
            messagebox.showerror(
                "Error",
                "Por favor ingresa la URL del repositorio"
            )
            return
            
        self.export_button.config(state="disabled")
        self.log_text.delete(1.0, tk.END)
        self.log_status("Iniciando exportación...")
        
        try:
            exporter = RepoExporter(token)
            output_file = exporter.export_repo(url, self.log_status)
            
            if output_file:
                self.log_status(
                    f"\nRepositorio exportado exitosamente a: {output_file}"
                )
                messagebox.showinfo(
                    "Éxito",
                    f"Repositorio exportado a {output_file}"
                )
            else:
                messagebox.showerror(
                    "Error",
                    "No se pudo exportar el repositorio"
                )
                
        except Exception as e:
            self.log_status(f"Error: {str(e)}")
            messagebox.showerror("Error", str(e))
            
        finally:
            self.export_button.config(state="normal")

class RepoExporter:
    def __init__(self, token=None):
        self.g = Github(token) if token else Github()
        
    def export_repo(self, repo_url, status_callback=None):
        def log(msg):
            if status_callback:
                status_callback(msg)
            else:
                print(msg)
                
        try:
            parts = repo_url.rstrip('/').split('/')
            owner, repo_name = parts[-2], parts[-1]
            
            log(f"Conectando al repositorio {owner}/{repo_name}...")
            repo = self.g.get_repo(f"{owner}/{repo_name}")
            
            result = {
                'repo_name': repo.name,
                'file_structure': {},
                'files_content': {}
            }
            
            def process_contents(contents, current_path=''):
                for item in contents:
                    path = os.path.join(current_path, item.name)
                    if item.type == 'dir':
                        log(f"Procesando directorio: {path}")
                        result['file_structure'][path] = 'directory'
                        process_contents(repo.get_contents(item.path), path)
                    else:
                        log(f"Procesando archivo: {path}")
                        result['file_structure'][path] = 'file'
                        try:
                            content = base64.b64decode(item.content).decode('utf-8', errors='ignore')
                            result['files_content'][path] = content
                        except Exception as e:
                            log(f"Error procesando {path}: {str(e)}")
            
            log("Iniciando procesamiento del repositorio...")
            process_contents(repo.get_contents(""))
            
            output_filename = f"codeforias_{repo_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            log(f"Guardando resultados en {output_filename}...")
            
            with open(output_filename, 'w', encoding='utf-8') as f:
                f.write(f"CodeForias - Exportación de Repositorio\n")
                f.write(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"Repositorio: {repo_name}\n\n")
                
                f.write("Estructura de Archivos:\n")
                f.write("="*50 + "\n")
                for path, type_ in result['file_structure'].items():
                    f.write(f"{type_}: {path}\n")
                    
                f.write("\nContenido de Archivos:\n")
                f.write("="*50 + "\n")
                for path, content in result['files_content'].items():
                    f.write(f"\n{'='*80}\n")
                    f.write(f"Archivo: {path}\n")
                    f.write(f"{'='*80}\n")
                    f.write(content)
                    f.write("\n")
            
            return output_filename
            
        except Exception as e:
            log(f"Error exportando repositorio: {e}")
            raise

if __name__ == "__main__":
    app = CodeForiasGUI()
    app.root.mainloop()