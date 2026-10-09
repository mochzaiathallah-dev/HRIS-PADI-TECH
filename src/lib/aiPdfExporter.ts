import jsPDF from 'jspdf'

async function loadBase64Image(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/**
 * Ekspor teks hasil pembuatan soal / penjelasan materi AI menjadi file PDF resmi
 * dengan branding HRIS PADI TECH, margin rapi, dan multi-page auto-splitting.
 * Mendukung penyisipan gambar AI ilustrasi materi jika tersedia.
 */
export async function exportAiContentToPdf(
  content: string, 
  role: string = 'tutor', 
  promptContext?: string,
  imageUrl?: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 18
  const maxContentWidth = pageWidth - margin * 2

  // 1. Header Banner HRIS PADI TECH (Navy Blue)
  doc.setFillColor(30, 58, 138)
  doc.roundedRect(margin, 15, maxContentWidth, 22, 2.5, 2.5, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('HRIS PADI TECH - LEMBAR SOAL & PANDUAN BELAJAR', margin + 6, 24)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const roleLabel = role === 'host' ? 'Host Live Commerce' : role === 'owner' ? 'Owner Executive' : 'Tutor Bimbingan Belajar'
  const dateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  doc.text(`Asisten AI untuk ${roleLabel} | Dibuat pada: ${dateStr}`, margin + 6, 31)

  let cursorY = 44

  // 2. Kotak Topik / Konteks jika ada
  if (promptContext) {
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(margin, cursorY, maxContentWidth, 11, 2, 2, 'F')
    doc.setTextColor(71, 85, 105)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    const promptText = `Topik / Instruksi: "${promptContext.slice(0, 90)}${promptContext.length > 90 ? '...' : ''}"`
    doc.text(promptText, margin + 4, cursorY + 7)
    cursorY += 16
  }

  // 3. Sisipkan Gambar AI jika tersedia
  if (imageUrl) {
    try {
      const base64 = await loadBase64Image(imageUrl)
      if (base64) {
        const imgWidth = 95
        const imgHeight = 72
        const imgX = margin + (maxContentWidth - imgWidth) / 2
        if (cursorY + imgHeight > pageHeight - 25) {
          doc.addPage()
          cursorY = 20
        }
        doc.addImage(base64, 'JPEG', imgX, cursorY, imgWidth, imgHeight)
        cursorY += imgHeight + 8
      }
    } catch (e) {
      console.warn('Notice embedding AI image in PDF:', e)
    }
  }

  // 3. Render Konten Teks
  doc.setFontSize(9)

  // Bersihkan markdown bintang ganda (**) dan header (#) agar rapi
  const cleanContent = content
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^#+\s+/gm, '')

  const lines = doc.splitTextToSize(cleanContent, maxContentWidth)

  for (let i = 0; i < lines.length; i++) {
    if (cursorY > pageHeight - 20) {
      // Footer halaman
      doc.setFontSize(7.5)
      doc.setTextColor(148, 163, 184)
      doc.text(`HRIS PADI TECH AI Assistant - Halaman ${doc.getNumberOfPages()}`, margin, pageHeight - 8)

      doc.addPage()
      cursorY = 18

      // Divider tipis halaman berikutnya
      doc.setDrawColor(226, 232, 240)
      doc.line(margin, cursorY - 4, pageWidth - margin, cursorY - 4)
    }

    const line = lines[i]
    // Deteksi baris nomor soal atau judul bagian
    if (/^[0-9]+\.|\bKunci Jawaban\b|\bSoal\b|\bPenyelesaian\b|\bLangkah-langkah\b/i.test(line)) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 58, 138)
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 41, 59)
    }

    doc.text(line, margin, cursorY)
    cursorY += 4.9
  }

  // Footer di halaman terakhir
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(`HRIS PADI TECH AI Assistant - Halaman ${doc.getNumberOfPages()}`, margin, pageHeight - 8)

  const safeTitle = (promptContext || 'Materi_Soal')
    .slice(0, 25)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `Bank_Soal_${safeTitle}_${Date.now()}.pdf`
  doc.save(fileName)
}
