import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api';

export default function Import() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ total: number; successCount: number; errors: string[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
      setErrorMsg('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
      setErrorMsg('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setErrorMsg('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/import/excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (response.data.success) {
        setResult(response.data.data);
      }
    } catch (error: any) {
      setErrorMsg(error.response?.data?.error || 'Произошла ошибка при загрузке файла');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Импорт данных из 1С / Excel</h1>
          <p className="text-slate-500 text-sm mt-1">Оцифровка склада и загрузка остатков</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        {/* Инструкция */}
        <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-4">
          <FileSpreadsheet className="w-6 h-6 text-blue-500 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900">Формат файла</h3>
            <p className="text-sm text-blue-700 mt-1">
              Загрузите файл Excel (.xlsx, .xls) или CSV. Таблица должна содержать столбцы: 
              <br/><b>Штрихкод</b>, <b>Название</b>, <b>Количество</b> (необязательно: МНН, Группа).
            </p>
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div 
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
            isDragging ? 'border-cyan-500 bg-cyan-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            accept=".xlsx, .xls, .csv"
          />
          
          <UploadCloud className={`w-16 h-16 mx-auto mb-4 ${isDragging ? 'text-cyan-500' : 'text-slate-400'}`} />
          
          {file ? (
            <div>
              <p className="text-lg font-semibold text-slate-800">{file.name}</p>
              <p className="text-sm text-slate-500 mt-1">Размер: {(file.size / 1024 / 1024).toFixed(2)} МБ</p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-semibold text-slate-700">Перетащите файл сюда</p>
              <p className="text-sm text-slate-500 mt-1">или нажмите, чтобы выбрать на компьютере</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              !file || loading
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-cyan-600 text-white hover:bg-cyan-700 shadow-md hover:shadow-lg'
            }`}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
            {loading ? 'Загрузка...' : 'Загрузить в базу'}
          </button>
        </div>

        {/* Results */}
        {errorMsg && (
          <div className="mt-8 p-4 bg-rose-50 border border-rose-200 rounded-xl flex gap-3 text-rose-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {result && (
          <div className="mt-8 space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div className="flex gap-3 items-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <div>
                  <h3 className="font-bold text-emerald-900">Импорт завершен</h3>
                  <p className="text-sm text-emerald-700">Успешно загружено: {result.successCount} из {result.total} записей</p>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="p-4 bg-white border border-rose-100 rounded-xl">
                <h4 className="font-bold text-rose-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> 
                  Ошибки при загрузке ({result.errors.length}):
                </h4>
                <ul className="text-sm text-slate-600 space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                  {result.errors.map((err, idx) => (
                    <li key={idx} className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
