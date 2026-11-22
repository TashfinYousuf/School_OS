#!/usr/bin/env python3
"""
Generates a realistic 8.9 MB Class 1 Bangla Textbook PDF fixture for EducationOS RAG testing.
Includes realistic Bangla text (Amar Bangla Boi), poems, vocabulary, chapters,
and distinct page illustrations bringing the file size to ~8.9 MB.
"""
import io
import os
import sys
from PIL import Image, ImageDraw
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

HAS_BANGLA_FONT = False
try:
    pdfmetrics.registerFont(TTFont("BanglaFont", "/System/Library/Fonts/Supplemental/Bangla Sangam MN.ttc", subfontIndex=0))
    HAS_BANGLA_FONT = True
except Exception as fe:
    print(f"Warning: could not register Bangla Sangam font: {fe}")

def create_page_illustration(page_num, width=1400, height=1000):
    # Unique color palette and pattern per page
    r = 200 + (page_num * 17) % 50
    g = 210 + (page_num * 31) % 40
    b = 220 + (page_num * 13) % 35
    img = Image.new("RGB", (width, height), color=(r, g, b))
    draw = ImageDraw.Draw(img)
    
    # Draw geometric figures simulating page drawings
    for i in range(0, width, 25):
        draw.line([(i, 0), (width - i, height)], fill=(r - 20, g - 20, b - 15), width=2)
    for j in range(0, height, 25):
        draw.line([(0, j), (width, height - j)], fill=(r - 25, g - 15, b - 20), width=2)
    
    draw.rectangle([60, 60, width - 60, height - 60], outline=(100, 140, 190), width=6)
    draw.ellipse([width//4, height//4, 3*width//4, 3*height//4], outline=(120, 160, 210), width=4)
    
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()

def generate_bangla_8_9mb_textbook(output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    c = canvas.Canvas(output_path, pagesize=letter)
    page_width, page_height = letter
    
    # Cover
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(page_width / 2.0, page_height - 80, "KIDS SHINE INTERNATIONAL SCHOOL")
    c.setFont("Helvetica", 14)
    c.drawCentredString(page_width / 2.0, page_height - 110, "Class 1 Bangla National Curriculum Textbook")
    c.setFont("Helvetica-Oblique", 11)
    c.drawCentredString(page_width / 2.0, page_height - 130, "Amar Bangla Boi - Primary Academic Series 2026")
    cover_img = ImageReader(io.BytesIO(create_page_illustration(0)))
    c.drawImage(cover_img, 72, page_height - 520, width=468, height=350)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(page_width / 2.0, 160, "National Curriculum and Textbook Board (NCTB) Reference Edition")
    c.setFont("Helvetica", 10)
    c.drawCentredString(page_width / 2.0, 135, "Digitized & Indexed for EducationOS RAG Pedagogical Reasoning Engine")
    c.drawCentredString(page_width / 2.0, 115, "ISBN 978-984-68-0192-3 | Academic Year: 2026 | Pilot Tenant: Kids Shine")
    c.showPage()
    
    bangla_chapters = [
        ("অধ্যায় ১: আমার পরিচয় ও বর্ণমালার গান", [
            "আমার নাম মিনু। আমি প্রথম শ্রেণিতে পড়ি। আমাদের স্কুলের নাম কিডস শাইন ইন্টারন্যাশনাল স্কুল।",
            "আমরা প্রতিদিন স্কুলে যাই। শিক্ষক আমাদের খুব ভালোবাসেন। আমরা একসাথে গান গাই ও ছবি আঁকি।",
            "অ - অজগর আসছে তেড়ে। আ - আমটি আমি খাব পেড়ে।",
            "ই - ইঁদুর ছানা ভয়ে মরে। ঈ - ঈগল পাখি পাছে ধরে।",
            "উ - উট চলেছে মুখটি তুলে। ঊ - ঊষা হাসে পূব আকাশে।",
            "ঋ - ঋষি মশাই বসেন পূজায়। এ - এক্কা গাড়ি খুব ছুটেছে।",
            "ঐ - ওই দেখো ভাই চাঁদ উঠেছে। ও - ওল খেয়ো না ধরবে গলা।",
            "ঔ - ওষুধ খাও সেরে যাবে রোগ।"
        ]),
        ("অধ্যায় ২: মজার ছড়া - আতা গাছে তোতা পাখি", [
            "আতা গাছে তোতা পাখি, ডালিম গাছে মৌ,",
            "এত ডাকি তবু কথা কও না কেন বউ?",
            "",
            "ভোর হলো দোর খোলো, খুকুমণি ওঠ রে!",
            "ঐ ডাকে জুঁই-শাখে, ফুল-খুকী ছোট রে!",
            "খুলী হাল তুলী পাল, ঐ তরী চলল,",
            "এইবার এইবার, খুকু চোখ খুলল।"
        ]),
        ("অধ্যায় ৩: আমাদের জাতীয় প্রতীক ও বাংলাদেশ", [
            "আমাদের দেশের নাম বাংলাদেশ। বাংলাদেশ একটি সুন্দর ও সবুজ দেশ।",
            "আমাদের জাতীয় ফুল শাপলা। জাতীয় ফল কাঁঠাল। জাতীয় মাছ রূপালী ইলিশ।",
            "জাতীয় পশু রয়েল বেঙ্গল টাইগার। জাতীয় পাখি দোয়েল।",
            "আমাদের জাতীয় পতাকা লাল ও সবুজ রঙের। সবুজ জমিনের ওপর রক্তিম লাল সূর্য।",
            "আমরা আমাদের দেশকে খুব ভালোবাসি। আমরা দেশকে সুন্দর রাখব।"
        ]),
        ("অধ্যায় ৪: ব্যঞ্জনবর্ণ ও শব্দ গঠন", [
            "ক - কলম দিয়ে লিখি। খ - খবর পড়ি রোজ। গ - গরু মাঠে ঘাস খায়।",
            "ঘ - ঘর আমাদের শান্তির নীড়। ঙ - ব্যাঙ ডাকে ঘ্যাঙর ঘ্যাঙ।",
            "চ - চাঁদ উঠেছে আকাশে। ছ - ছাতা মাথায় খোকা যায়।",
            "জ - জল পড়ে পাতা নড়ে। ঝ - ঝড় এলো এলো রে। ঞ - মিঞা ভাই গান গায়।",
            "ট - টিয়া পাখির ঠোঁটটি লাল। ঠ - ঠাকুরদাদার দাড়ি সাদা। ড - ডালিম গাছে ফল।"
        ]),
        ("অধ্যায় ৫: পড়ার আনন্দ ও বুদ্ধিমান টুনি", [
            "এক ছিল টুনি আর এক ছিল কাক। টুনি তার ছানাদের নিয়ে ডালিম গাছে বাসা বানাল।",
            "একদিন কাক এসে বলল, 'টুনি টুনি, তোর ছানাগুলো আমাকে দে।'",
            "টুনি বলল, 'না না কাক ভাই, ওদের ছুঁয়ো না। ওরা অনেক ছোট।'",
            "টুনি বুদ্ধিমতী ছিল। সে কাঁচি দিয়ে কাককে তাড়াল। টুনি তার ছানাদের নিয়ে আনন্দে রইল।",
            "নীতিকথা: বিপদে বুদ্ধি খাটালে রক্ষা পাওয়া যায়।"
        ]),
        ("অধ্যায় ৬: ছয় ঋতুর দেশ বাংলাদেশ", [
            "বাংলাদেশে ছয়টি ঋতু আছে: গ্রীষ্ম, বর্ষা, শরৎ, হেমন্ত, শীত ও বসন্ত।",
            "গ্রীষ্মকালে আম জাম লিচু পাকে। বৈশাখ মাসে কালবৈশাখী ঝড় হয়।",
            "বর্ষাকালে আকাশ মেঘলা থাকে। নদী-নালা পানিতে ভরে যায়। কদম ফুল ফোটে।",
            "শরৎকালে কাশফুল ফোটে। সাদা মেঘ আকাশে উড়ে বেড়ায়।",
            "শীতকালে কুয়াশা পড়ে। গরম পিঠা খাওয়ার ধুম পড়ে।",
            "বসন্ত ঋতুরাজ। কোকিল ডাকে কুহু কুহু। নানা রঙের ফুলে বাগান সাজে।"
        ]),
        ("অধ্যায় ৭: স্বাস্থ্য ও পরিচ্ছন্নতা বিধি", [
            "প্রতিদিন সকালে ঘুম থেকে উঠে দাঁত মাজবে।",
            "খাবার আগে ও শৌচাগার ব্যবহারের পরে সাবান দিয়ে হাত ধোবে।",
            "নিয়মিত নখ কাটবে এবং পরিষ্কার কাপড় পরবে।",
            "বেশি করে শাকসবজি ও পরিষ্কার পানি পান করবে।",
            "শরীর সুস্থ থাকলে মনও ভালো থাকে।"
        ])
    ]
    
    # 45 unique pages gives 45 * 195KB = ~8.8-9.0 MB
    total_pages = 26
    font_name = "BanglaFont" if HAS_BANGLA_FONT else "Helvetica"
    for page_i in range(1, total_pages + 1):
        ch_title, lines = bangla_chapters[(page_i - 1) % len(bangla_chapters)]
        c.setFont(font_name, 13)
        c.drawString(72, page_height - 60, f"Page {page_i + 1} — {ch_title} (Lesson {(page_i // len(bangla_chapters)) + 1})")
        c.line(72, page_height - 66, page_width - 72, page_height - 66)
        
        # Unique illustration per page
        page_img = ImageReader(io.BytesIO(create_page_illustration(page_i)))
        c.drawImage(page_img, 72, page_height - 430, width=468, height=350)
        
        text_obj = c.beginText(72, page_height - 460)
        text_obj.setFont(font_name, 10)
        text_obj.setLeading(14)
        for line in lines:
            text_obj.textLine(line)
        c.drawText(text_obj)
        
        c.setFont("Helvetica", 9)
        c.drawString(72, 40, "Class 1 Bangla — Kids Shine International School Pilot 2026")
        c.drawRightString(page_width - 72, 40, f"Page {page_i + 1}")
        c.showPage()
        
    c.save()
    final_bytes = os.path.getsize(output_path)
    final_size_mb = final_bytes / (1024 * 1024)
    print(f"Generated PDF with {total_pages + 1} pages. Size: {final_size_mb:.2f} MB ({final_bytes} bytes)")

if __name__ == "__main__":
    target_path = "docs/syllabus/bangla_class1_textbook_8_9mb.pdf"
    generate_bangla_8_9mb_textbook(target_path)
