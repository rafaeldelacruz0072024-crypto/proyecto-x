from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.units import mm
import os

OUT = os.path.join(os.path.dirname(__file__), "PROYECTO-X_Tabla_Inversiones.pdf")

W, H = landscape(A4)  # 842 x 595

# ── Palette ────────────────────────────────────────────
BG      = HexColor("#020817")
SURFACE = HexColor("#0c0f1f")
SURF2   = HexColor("#111827")
SURF3   = HexColor("#0f172a")
CYAN    = HexColor("#00f3ff")
PURPLE  = HexColor("#6366f1")
GREEN   = HexColor("#4ade80")
YELLOW  = HexColor("#fbbf24")
AMBER   = HexColor("#f59e0b")
PINK    = HexColor("#c084fc")
SLATE   = HexColor("#334155")
MUTED   = HexColor("#475569")
TEXT    = HexColor("#f1f5f9")
TEXT2   = HexColor("#94a3b8")
RED     = HexColor("#f87171")

c = canvas.Canvas(OUT, pagesize=landscape(A4))
c.setTitle("PROYECTO X | Tabla de Inversiones")

# ── Background ─────────────────────────────────────────
c.setFillColor(BG)
c.rect(0, 0, W, H, fill=1, stroke=0)

# Orbs
def orb(cx, cy, r, col, alpha=0.07):
    steps = 10
    for i in range(steps, 0, -1):
        a = alpha * (i / steps)
        c.setFillColor(Color(col.red, col.green, col.blue, a))
        c.circle(cx, cy, r * (i / steps), fill=1, stroke=0)

orb(80, H - 80, 160, PURPLE, 0.08)
orb(W - 80, 80, 140, CYAN, 0.06)
orb(W / 2, H / 2, 220, PURPLE, 0.025)

# ── Top gradient bar ───────────────────────────────────
steps = 60
for i in range(steps):
    t = i / steps
    r = CYAN.red + (PURPLE.red - CYAN.red) * t
    g = CYAN.green + (PURPLE.green - CYAN.green) * t
    b = CYAN.blue + (PURPLE.blue - CYAN.blue) * t
    c.setFillColor(Color(r, g, b, 1))
    c.rect(W * (i / steps), H - 3, W / steps + 0.5, 3, fill=1, stroke=0)

# ── Header ─────────────────────────────────────────────
c.setFillColor(SURFACE)
c.roundRect(14, H - 72, W - 28, 60, 10, fill=1, stroke=0)

c.setFillColor(CYAN)
c.setFont("Helvetica-Bold", 22)
c.drawString(30, H - 42, "PROYECTO X")

c.setFillColor(MUTED)
c.setFont("Helvetica", 7.5)
c.drawString(30, H - 55, "FUTURE FINANCE ECOSYSTEM")

c.setFillColor(TEXT)
c.setFont("Helvetica-Bold", 17)
c.drawRightString(W - 30, H - 38, "TABLA DE INVERSIONES")

c.setFillColor(TEXT2)
c.setFont("Helvetica", 8)
c.drawRightString(W - 30, H - 52, "ROI 2.2% Diario  ·  91 Días  ·  Duración hasta 200%  ·  Pagos en USDT")

# ── Key metrics pills ──────────────────────────────────
pills = [
    ("2.2% / DÍA",   HexColor("#001e20"), CYAN),
    ("66% / MES",    HexColor("#1a1208"), YELLOW),
    ("200% TOTAL",   HexColor("#0a2510"), GREEN),
    ("91 DÍAS",      HexColor("#0f0720"), PINK),
]
pill_y = H - 88
pill_x = 14
for txt, bg, fg in pills:
    c.setFont("Helvetica-Bold", 7.5)
    tw = c.stringWidth(txt, "Helvetica-Bold", 7.5)
    pw = tw + 20
    c.setFillColor(bg)
    c.roundRect(pill_x, pill_y, pw, 14, 5, fill=1, stroke=0)
    c.setFillColor(fg)
    c.drawCentredString(pill_x + pw / 2, pill_y + 3.5, txt)
    pill_x += pw + 6

# ── Table ──────────────────────────────────────────────
AMOUNTS = [100, 500, 1000, 2000, 5000, 10000]

DAILY_ROI = 0.022
MONTHLY_PCT = DAILY_ROI * 30  # 66%
DURATION = 91
TOTAL_ROI_PCT = 2.0            # 200%

TABLE_TOP = H - 102
TABLE_BOT = 38
TABLE_H = TABLE_TOP - TABLE_BOT
ROW_H = (TABLE_H - 22) / len(AMOUNTS)  # -22 for header

# Column definitions: (label, width_ratio, align)
COLS = [
    ("MONTO\nINVERTIDO",        0.13, "center"),
    ("ROI DIARIO\n(USDT)",       0.13, "center"),
    ("GANANCIA\nMENSUAL (USDT)", 0.14, "center"),
    ("% MENSUAL\nROI",           0.11, "center"),
    ("GANANCIA\nEN 91 DÍAS",     0.14, "center"),
    ("TOTAL AL\nVENCIMIENTO",    0.14, "center"),
    ("RETORNO\nNETO",            0.12, "center"),
    ("DUPLICACIÓN\nESTATUS",     0.09, "center"),
]

MARGIN = 14
TABLE_W = W - MARGIN * 2
col_widths = [TABLE_W * r for _, r, _ in COLS]
col_xs = []
cx_acc = MARGIN
for cw in col_widths:
    col_xs.append(cx_acc)
    cx_acc += cw

HEADER_H = 26

# ── Table background ───────────────────────────────────
c.setFillColor(SURFACE)
c.setStrokeColor(SLATE)
c.setLineWidth(0.5)
c.roundRect(MARGIN, TABLE_BOT, TABLE_W, TABLE_H, 10, fill=1, stroke=1)

# ── Header row ─────────────────────────────────────────
# Header gradient bg
steps2 = 40
for i in range(steps2):
    t = i / steps2
    r = PURPLE.red + (CYAN.red - PURPLE.red) * t
    g = PURPLE.green + (CYAN.green - PURPLE.green) * t
    b = PURPLE.blue + (CYAN.blue - PURPLE.blue) * t
    slice_w = TABLE_W / steps2
    c.setFillColor(Color(r, g, b, 0.9))
    xpos = MARGIN + i * slice_w
    if i == 0:
        c.roundRect(xpos, TABLE_TOP - HEADER_H, slice_w + 2, HEADER_H, 10, fill=1, stroke=0)
    elif i == steps2 - 1:
        c.roundRect(xpos - 1, TABLE_TOP - HEADER_H, slice_w + 2, HEADER_H, 10, fill=1, stroke=0)
    else:
        c.rect(xpos, TABLE_TOP - HEADER_H, slice_w + 0.5, HEADER_H, fill=1, stroke=0)

# Header labels
for j, (lbl, _, align) in enumerate(COLS):
    lines = lbl.split("\n")
    cx_h = col_xs[j] + col_widths[j] / 2
    y_start = TABLE_TOP - 8
    for li, line in enumerate(lines):
        c.setFillColor(HexColor("#020817"))
        c.setFont("Helvetica-Bold", 6.5)
        c.drawCentredString(cx_h, y_start - li * 8, line)

# ── Data rows ──────────────────────────────────────────
tier_colors = [
    (100,  HexColor("#cd7f32")),   # Bronze
    (500,  HexColor("#fbbf24")),   # Gold
    (1000, HexColor("#e5e4e2")),   # Platinum
    (2000, HexColor("#00f3ff")),   # Diamond
    (5000, HexColor("#c084fc")),   # Black Crown
    (10000,HexColor("#c084fc")),   # Black Crown
]
tier_labels = {
    100:   "Bronze",
    500:   "Gold",
    1000:  "Platinum",
    2000:  "Diamond",
    5000:  "Black Crown",
    10000: "Black Crown",
}

for i, amt in enumerate(AMOUNTS):
    row_y = TABLE_TOP - HEADER_H - (i + 1) * ROW_H
    row_col = tier_colors[i][1]

    # Alternating row bg
    if i % 2 == 0:
        c.setFillColor(Color(0.05, 0.07, 0.12, 0.8))
    else:
        c.setFillColor(Color(0.07, 0.09, 0.16, 0.8))
    c.rect(MARGIN + 1, row_y, TABLE_W - 2, ROW_H, fill=1, stroke=0)

    # Left accent bar with tier color
    c.setFillColor(Color(row_col.red, row_col.green, row_col.blue, 0.8))
    c.rect(MARGIN + 1, row_y, 3, ROW_H, fill=1, stroke=0)

    # Calculate values
    daily_earn   = amt * DAILY_ROI
    monthly_earn = amt * MONTHLY_PCT
    monthly_pct  = MONTHLY_PCT * 100               # 66%
    earn_91      = amt * DAILY_ROI * DURATION       # earnings only
    total_end    = amt + earn_91                    # capital + earnings
    net_return   = earn_91                          # pure gain

    values = [
        f"${amt:,.0f}",
        f"${daily_earn:,.2f}",
        f"${monthly_earn:,.2f}",
        f"{monthly_pct:.0f}%",
        f"${earn_91:,.2f}",
        f"${total_end:,.2f}",
        f"+${net_return:,.2f}",
        tier_labels.get(amt, "—"),
    ]

    value_colors = [
        TEXT,    # monto
        CYAN,    # daily
        YELLOW,  # monthly
        YELLOW,  # %
        GREEN,   # 91d earnings
        HexColor("#00ff9d"),  # total
        GREEN,   # net
        row_col, # tier
    ]

    row_cy = row_y + ROW_H / 2

    for j, (val, vcol) in enumerate(zip(values, value_colors)):
        cx_v = col_xs[j] + col_widths[j] / 2
        c.setFillColor(vcol)
        if j == 0:
            c.setFont("Helvetica-Bold", 13)
        elif j == 7:
            c.setFont("Helvetica-Bold", 10)
        else:
            c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(cx_v, row_cy - 4, val)

    # Row separator
    if i < len(AMOUNTS) - 1:
        c.setStrokeColor(Color(0.2, 0.25, 0.35, 0.4))
        c.setLineWidth(0.3)
        c.line(MARGIN + 8, row_y, MARGIN + TABLE_W - 8, row_y)

# ── Column separators ──────────────────────────────────
for j in range(1, len(COLS)):
    c.setStrokeColor(Color(0.2, 0.25, 0.35, 0.3))
    c.setLineWidth(0.3)
    c.line(col_xs[j], TABLE_BOT + 4, col_xs[j], TABLE_TOP - HEADER_H)

# ── Table border ───────────────────────────────────────
c.setStrokeColor(SLATE)
c.setLineWidth(0.8)
c.roundRect(MARGIN, TABLE_BOT, TABLE_W, TABLE_H, 10, fill=0, stroke=1)

# ── Footer ─────────────────────────────────────────────
c.setFillColor(MUTED)
c.setFont("Helvetica", 6)
c.drawString(MARGIN, 20,
    "* Proyecciones basadas en ROI diario fijo de 2.2% durante 91 días. "
    "Los rendimientos son estimados y sujetos a las condiciones del sistema.  "
    "Total al vencimiento = Capital + Ganancias acumuladas (200% del capital invertido).")
c.drawRightString(W - MARGIN, 20, "proyecto-x-user.vercel.app")

c.save()
print("PDF generado:", OUT)
