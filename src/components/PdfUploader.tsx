import { useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PdfUploaderProps {
  uploadedFile: File | null
  onFileUpload: (file: File) => void
  onClear: () => void
  isProcessing?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PdfUploader({ uploadedFile, onFileUpload, onClear, isProcessing = false }: PdfUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    setError(null)
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }
    onFileUpload(file)
  }, [onFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }, [handleFile])

  const handleBrowse = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Drop Zone */}
      <div className="flex-1 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute inset-0 rounded-xl overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {!uploadedFile ? (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleBrowse}
                className={`
                  h-full flex flex-col items-center justify-center cursor-pointer
                  rounded-xl border-2 border-dashed transition-all duration-200
                  ${isDragActive
                    ? 'border-gold-500 bg-gold-500/[0.05]'
                    : 'border-white/[0.12] bg-white/[0.03] hover:border-white/[0.2] hover:bg-white/[0.05]'
                  }
                `}
              >
                {/* Upload icon */}
                <motion.div
                  animate={isDragActive ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="mb-5"
                >
                  <svg
                    className={`w-14 h-14 transition-colors duration-200 ${isDragActive ? 'text-gold-400' : 'text-navy-400'}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <polyline points="9 15 12 12 15 15" />
                  </svg>
                </motion.div>

                <p className={`text-lg font-medium mb-1 transition-colors duration-200 ${isDragActive ? 'text-gold-300' : 'text-cream-100'}`}>
                  Drop your PDF here
                </p>
                <p className="text-sm text-navy-400">
                  or click to browse
                </p>

                {/* Error message */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 text-sm text-red-400 font-medium"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="uploaded"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="h-full flex flex-col items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                {/* Success state */}
                <div className="flex flex-col items-center">
                  {/* PDF icon */}
                  <div className="w-16 h-20 relative mb-5">
                    <div className="absolute inset-0 bg-gradient-to-br from-gold-500/20 to-gold-600/10 rounded-lg" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <svg
                        className="w-8 h-8 text-gold-400 mb-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-[10px] font-bold text-gold-400 uppercase tracking-wider">PDF</span>
                    </div>
                  </div>

                  {/* File info */}
                  <p className="text-lg font-medium text-cream-100 mb-1 text-center px-6 truncate max-w-full">
                    {uploadedFile.name}
                  </p>
                  <p className="text-sm text-navy-400 mb-4">
                    {formatFileSize(uploadedFile.size)}
                  </p>

                  {/* Status indicator */}
                  {isProcessing ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-gold-500/10 rounded-full">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <svg className="w-4 h-4 text-gold-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                        </svg>
                      </motion.div>
                      <span className="text-sm font-medium text-gold-400">Analyzing document...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full">
                      <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round" />
                        <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-sm font-medium text-emerald-400">Analysis complete</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]"
      >
        <span className="text-sm text-navy-400">
          {uploadedFile ? (
            <span className="text-cream-300 font-medium">1 file uploaded</span>
          ) : (
            'No file selected'
          )}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            disabled={!uploadedFile}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-navy-400 hover:text-cream-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>

          <button
            onClick={handleBrowse}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white/[0.06] text-cream-200 hover:bg-white/[0.1] rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
            </svg>
            Browse
          </button>
        </div>
      </motion.div>
    </div>
  )
}
