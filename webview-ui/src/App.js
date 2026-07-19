import { useState } from "react";
import "./App.css";
const vscode = acquireVsCodeApi();
function App() {
    const [version, setVersion] = useState("");
    const [notes, setNotes] = useState("");
    const handleRelease = () => {
        if (!version.trim()) {
            alert("Введите номер версии!");
            return;
        }
        vscode.postMessage({
            command: "createRelease",
            data: { version, notes },
        });
    };
    return (<div className="container">
      <h2 className="title">📦 Git Releas32432423e Master 1</h2>
      <p className="subtitle">Подготовьте ваш следующий релиз</p>

      <div className="form-group">
        <label className="label">Номер версии (Tag)</label>
        <input type="text" className="input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Например: v1.0.0"/>
      </div>

      <div className="form-group">
        <label className="label">Описание релиза (Release Notes)</label>
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Что нового в этой версии?" rows={5}/>
      </div>

      <button className="button" onClick={handleRelease}>
        🚀 Создать релиз
      </button>
    </div>);
}
export default App;
//# sourceMappingURL=App.js.map