import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { LaporanBimbel } from '@/types'

export interface StudentReportParams {
  namaSiswa: string
  kelas: string
  tutorNama: string
  periodeBulan: string // e.g. "September 2026"
  evaluasiTutor?: string
  sesiList: LaporanBimbel[]
}

/**
 * Format date into "Rabu, 9 Sept 2026"
 */
function formatIndonesianDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agust', 'Sept', 'Okt', 'Nov', 'Des'
    ]
    const dayName = days[d.getDay()]
    const dateNum = d.getDate()
    const monthName = months[d.getMonth()]
    const year = d.getFullYear()
    return `${dayName}, ${dateNum} ${monthName} ${year}`
  } catch {
    return dateStr
  }
}

/**
 * Format summary string into clean bullet points
 */
function formatBulletPoints(text: string): string {
  if (!text) return '-'
  // If already contains bullets, normalize
  const lines = text
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length > 1) {
    return lines.map((l) => (l.startsWith('•') || l.startsWith('-') ? `• ${l.replace(/^[•\-]\s*/, '')}` : `• ${l}`)).join('\n')
  }

  // If single sentence, split by sentences or keep
  return `• ${text.replace(/^[•\-]\s*/, '')}`
}

/**
 * Generate PDF matching "Laporan Belajar Siswa" layout
 */
export function generateStudentReportPDF(params: StudentReportParams) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  const primaryNavy = [13, 39, 87] as [number, number, number] // #0d2757
  const textDark = [30, 41, 59] as [number, number, number] // #1e293b
  const borderGrey = [148, 163, 184] as [number, number, number] // #94a3b8

  // -------------------------------------------------------------
  // 1. TOP HEADER BOX
  // -------------------------------------------------------------
  const headerBoxY = 12
  const headerBoxHeight = 22

  // Rounded rectangle border
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2])
  doc.setLineWidth(0.4)
  doc.roundedRect(margin, headerBoxY, contentWidth, headerBoxHeight, 2.5, 2.5, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])

  // Left Column Labels & Values
  const leftColX = margin + 5
  const leftColValX = margin + 28
  let currentY = headerBoxY + 6

  doc.text('Nama Siswa', leftColX, currentY)
  doc.text(':', leftColValX - 2, currentY)
  doc.text(params.namaSiswa || '-', leftColValX, currentY)

  currentY += 5
  doc.text('Kelas', leftColX, currentY)
  doc.text(':', leftColValX - 2, currentY)
  doc.text(params.kelas || '-', leftColValX, currentY)

  currentY += 5
  doc.text('Tutor', leftColX, currentY)
  doc.text(':', leftColValX - 2, currentY)
  doc.text(params.tutorNama || '-', leftColValX, currentY)

  // Right Column: Periode Laporan
  const rightColX = pageWidth - margin - 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`Periode Laporan :  ${params.periodeBulan || 'Semua Periode'}`, rightColX, headerBoxY + 11, {
    align: 'right',
  })

  // -------------------------------------------------------------
  // 2. SECTION TITLE: RINGKASAN KEGIATAN BELAJAR
  // -------------------------------------------------------------
  let sectionY = headerBoxY + headerBoxHeight + 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
  doc.text('RINGKASAN KEGIATAN BELAJAR', margin, sectionY)

  // -------------------------------------------------------------
  // 3. TABLE OF SESSIONS
  // -------------------------------------------------------------
  const tableData = params.sesiList.map((sesi, idx) => [
    `${idx + 1}.`,
    formatIndonesianDate(sesi.tanggal),
    sesi.mata_pelajaran || '-',
    sesi.topik || '-',
    formatBulletPoints(sesi.ringkasan),
  ])

  autoTable(doc, {
    startY: sectionY + 3,
    margin: { left: margin, right: margin },
    head: [['No.', 'Tanggal', 'Mata Pelajaran', 'Topik', 'Ringkasan Materi & Kegiatan']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryNavy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      valign: 'middle',
      cellPadding: 2.5,
    },
    bodyStyles: {
      textColor: textDark,
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [203, 213, 225],
      lineWidth: 0.25,
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 28, fontStyle: 'normal' },
      2: { cellWidth: 26, fontStyle: 'normal' },
      3: { cellWidth: 38, fontStyle: 'italic' },
      4: { cellWidth: 'auto', fontStyle: 'normal' },
    },
    didParseCell: (data) => {
      // Bold No header
      if (data.section === 'head' && data.column.index === 0) {
        data.cell.styles.halign = 'center'
      }
    },
  })

  // -------------------------------------------------------------
  // 4. SECTION: PERKEMBANGAN BELAJAR
  // -------------------------------------------------------------
  const finalTableY = (doc as any).lastAutoTable?.finalY || sectionY + 60
  let evalSectionY = finalTableY + 7

  // Check if we need a new page for evaluation box
  if (evalSectionY + 28 > pageHeight - 15) {
    doc.addPage()
    evalSectionY = 15
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2])
  doc.text('PERKEMBANGAN BELAJAR', margin, evalSectionY)

  // Default evaluation generator based on subjects covered if not custom provided
  let defaultEval = params.evaluasiTutor
  if (!defaultEval || defaultEval.trim() === '') {
    const distinctMapel = Array.from(new Set(params.sesiList.map((s) => s.mata_pelajaran))).join(', ')
    defaultEval = `Sepanjang periode ${params.periodeBulan || 'pembelajaran'}, ${params.namaSiswa} telah mengikuti seluruh rangkaian sesi bimbingan belajar untuk materi ${distinctMapel || 'terkait'}. Siswa menunjukkan konsistensi, pemahaman materi yang terus meningkat, serta sikap yang antusias dan kooperatif dalam menyelesaikan seluruh latihan soal bersama tutor pendamping.`
  }

  const evalBoxY = evalSectionY + 3
  const evalBoxHeight = 22

  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2])
  doc.setLineWidth(0.4)
  doc.roundedRect(margin, evalBoxY, contentWidth, evalBoxHeight, 2.5, 2.5, 'S')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(textDark[0], textDark[1], textDark[2])

  const splitEvalText = doc.splitTextToSize(defaultEval, contentWidth - 6)
  doc.text(splitEvalText, margin + 3, evalBoxY + 4.5, {
    lineHeightFactor: 1.35,
  })

  // -------------------------------------------------------------
  // 5. FOOTER ON ALL PAGES
  // -------------------------------------------------------------
  const totalPages = (doc.internal as any).getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)

    // Left footer
    doc.text(`Laporan Belajar Siswa - ${params.namaSiswa}`, margin, pageHeight - 6)

    // Right footer
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    })
  }

  // Download PDF file directly in browser
  const sanitizedName = params.namaSiswa.replace(/[^a-zA-Z0-9_-]/g, '_')
  const sanitizedPeriod = (params.periodeBulan || 'Laporan').replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `Laporan_Belajar_${sanitizedName}_${sanitizedPeriod}.pdf`

  doc.save(fileName)
}
