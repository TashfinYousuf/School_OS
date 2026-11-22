import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

def generate_ksis_syllabus_pdf():
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "docs", "syllabus"))
    os.makedirs(out_dir, exist_ok=True)
    pdf_path = os.path.join(out_dir, "KSIS_Class5_Science_Syllabus_2026.pdf")

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1E3A8A'),
        alignment=1
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#4B5563'),
        alignment=1
    )
    heading_style = ParagraphStyle(
        'ChapterHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#0F766E'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=15,
        textColor=colors.HexColor('#1F2937'),
        spaceAfter=8
    )
    highlight_style = ParagraphStyle(
        'Highlight',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#1E40AF'),
        leftIndent=15,
        spaceAfter=8
    )

    story = []

    # Header
    story.append(Paragraph("KIDS SHINE INTERNATIONAL SCHOOL", title_style))
    story.append(Paragraph("Department of Natural Sciences & NCTB Academic Affairs", subtitle_style))
    story.append(Paragraph("Official Class 5 Science Curriculum & Pedagogical Syllabus — Academic Year 2026", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1E3A8A'), spaceAfter=15))

    # Overview Table
    summary_data = [
        [Paragraph("<b>Institution:</b> Kids Shine International School", body_style), Paragraph("<b>Academic Year:</b> 2026", body_style)],
        [Paragraph("<b>Grade / Class:</b> Class 5 (Primary Terminal)", body_style), Paragraph("<b>National Curriculum:</b> NCTB Integrated", body_style)],
        [Paragraph("<b>Subject:</b> General Science", body_style), Paragraph("<b>Code:</b> SCI-05-2026", body_style)],
    ]
    t = Table(summary_data, colWidths=[270, 260])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F3F4F6')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#D1D5DB')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 15))

    # Chapter 1
    story.append(Paragraph("Chapter 1: The Human Body & Organ Systems", heading_style))
    story.append(Paragraph(
        "The human body is an intricate network of specialized organ systems working in harmony. "
        "The circulatory system is anchored by the heart, a muscular organ that pumps oxygenated blood "
        "through arteries and returns deoxygenated blood through veins. At rest, an average human heart beats "
        "approximately 72 times per minute, adjusting dynamically under physical exertion.",
        body_style
    ))
    story.append(Paragraph(
        "In the digestive system, food undergoes mechanical and biochemical breakdown. "
        "A critical pedagogical fact is that bile is synthesized continuously by the liver, stored and concentrated "
        "in the gallbladder, and secreted into the duodenum (first part of the small intestine) to emulsify dietary fats.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Core Learning Outcome:</b> Students must identify the structural components of the digestive tract and describe the functions of the liver and gallbladder.",
        highlight_style
    ))
    story.append(Spacer(1, 10))

    # Chapter 2
    story.append(Paragraph("Chapter 2: Plant Biology & Photosynthesis", heading_style))
    story.append(Paragraph(
        "Green plants are primary producers responsible for converting radiant solar energy into chemical energy. "
        "Photosynthesis occurs predominantly within specialized chloroplasts located in the palisade mesophyll cell layer "
        "of leaves, where chlorophyll molecules capture photons.",
        body_style
    ))
    story.append(Paragraph(
        "Microscopic pores known as stomata, flanked by pairs of osmotic guard cells, are distributed primarily across "
        "the lower leaf epidermis. Stomata serve the dual purpose of facilitating gas exchange (absorbing carbon dioxide "
        "and releasing oxygen) while regulating transpiration to maintain plant hydrostatic equilibrium.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Core Learning Outcome:</b> Students must diagram a cross-section of a leaf, identify the palisade mesophyll layer, and explain how stomata control transpiration.",
        highlight_style
    ))
    story.append(Spacer(1, 10))

    # Chapter 3
    story.append(Paragraph("Chapter 3: Energy Resources & Bangladesh Environmental Conservation", heading_style))
    story.append(Paragraph(
        "Sustainable economic growth in Bangladesh requires an intentional transition toward renewable energy. "
        "Traditional reliance on natural gas and fossil fuels contributes to urban air pollution and greenhouse gas emissions. "
        "Under Bangladesh's National Solar Rooftop Initiative, the government and school communities aim to reduce institutional carbon "
        "emissions by 15% through the deployment of decentralized solar home systems (SHS) and rooftop solar installations.",
        body_style
    ))
    story.append(Paragraph(
        "In rural schools, solar photovoltaic micro-grids provide uninterrupted power to digital classrooms, enabling student multimedia "
        "learning while directly demonstrating practical environmental conservation.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Core Learning Outcome:</b> Students will distinguish between renewable and finite energy sources and quantify the carbon reduction objectives of national rooftop solar programs.",
        highlight_style
    ))
    story.append(Spacer(1, 15))

    # Footer note
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#9CA3AF'), spaceAfter=8))
    story.append(Paragraph(
        "Kids Shine International School • Academic Affairs Division • Curriculum Document Reference: KSIS-SYL-SCI5-2026",
        ParagraphStyle('Footer', parent=styles['Normal'], fontName='Helvetica', fontSize=8, textColor=colors.HexColor('#6B7280'), alignment=1)
    ))

    doc.build(story)
    print(f"Successfully generated KSIS Syllabus PDF at: {pdf_path}")
    return pdf_path

if __name__ == "__main__":
    generate_ksis_syllabus_pdf()

