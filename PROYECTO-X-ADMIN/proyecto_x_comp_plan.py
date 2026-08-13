from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

OUT = os.path.join(os.path.dirname(__file__), "PROYECTO-X_Plan_Compensacion.pdf")

W, H = A4  # 595 x 842

# ── Brand palette ──────────────────────────────────────
BG        = HexColor("#020817")
SURFACE   = HexColor("#0c0f1f")
SURFACE2  = HexColor("#111827")
CYAN      = HexColor("#00f3ff")
PURPLE    = HexColor("#6366f1")
GREEN     = HexColor("#4ade80")
YELLOW    = HexColor("#fbbf24")
AMBER     = HexColor("#f59e0b")
PINK      = HexColor("#c084fc")
SLATE     = HexColor("#334155")
MUTED     = HexColor("#475569")
TEXT      = HexColor("#f1f5f9")
TEXT2     = HexColor("#94a3b8")

c = canvas.Canvas(OUT, pagesize=A4)
c.setTitle("PROYECTO X | Plan de Compensación")

# ══════════════════════════════════════════════════════
# BACKGROUND
# ══════════════════════════════════════════════════════
c.setFillColor(BG)
c.rect(0, 0, W, H, fill=1, stroke=0)

# Subtle gradient orbs
def orb(cx, cy, r, color, alpha=0.06):
    from reportlab.lib.colors import Color
    steps = 12
    for i in range(steps, 0, -1):
        a = alpha * (i / steps)
        cr = Color(color.red, color.green, color.blue, a)
        c.setFillColor(cr)
        ri = r * (i / steps)
        c.circle(cx, cy, ri, fill=1, stroke=0)

orb(60, H - 60, 180, PURPLE, 0.07)
orb(W - 60, 120, 150, CYAN, 0.05)
orb(W / 2, H / 2, 200, HexColor("#6366f1"), 0.03)

# ══════════════════════════════════════════════════════
# HEADER BAND
# ══════════════════════════════════════════════════════
# Top gradient bar
from reportlab.lib.colors import Color
steps = 40
for i in range(steps):
    t = i / steps
    # cyan → purple gradient
    r = CYAN.red + (PURPLE.red - CYAN.red) * t
    g = CYAN.green + (PURPLE.green - CYAN.green) * t
    b = CYAN.blue + (PURPLE.blue - CYAN.blue) * t
    c.setFillColor(Color(r, g, b, 1))
    c.rect(W * (i / steps), H - 3, W / steps + 0.5, 3, fill=1, stroke=0)

# Header bg
c.setFillColor(SURFACE)
c.roundRect(14, H - 74, W - 28, 62, 10, fill=1, stroke=0)

# PROYECTO X wordmark
c.setFillColor(CYAN)
c.setFont("Helvetica-Bold", 22)
c.drawString(28, H - 44, "PROYECTO X")

# Tagline
c.setFillColor(MUTED)
c.setFont("Helvetica", 8)
c.drawString(28, H - 58, "FUTURE FINANCE ECOSYSTEM")

# Title
c.setFillColor(TEXT)
c.setFont("Helvetica-Bold", 16)
title = "PLAN DE COMPENSACIÓN"
c.drawRightString(W - 28, H - 44, title)

# Subtitle
c.setFillColor(TEXT2)
c.setFont("Helvetica", 8)
c.drawRightString(W - 28, H - 58, "5 Fuentes de Ingreso · USDT · Sin techo de ganancias")

# ══════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════
def card(x, y, w, h, fill=SURFACE, border=SLATE, radius=8, border_top_color=None, border_top_h=2):
    c.setFillColor(fill)
    c.setStrokeColor(border)
    c.setLineWidth(0.6)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)
    if border_top_color:
        c.setFillColor(border_top_color)
        c.roundRect(x, y + h - border_top_h, w, border_top_h, radius, fill=1, stroke=0)
        c.setFillColor(border_top_color)
        c.rect(x, y + h - border_top_h - 3, w, 3 + border_top_h, fill=1, stroke=0)
        c.roundRect(x, y + h - border_top_h, w, border_top_h, radius, fill=1, stroke=0)

def label(text, x, y, color=MUTED, size=7, bold=False):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x, y, text)

def label_r(text, x, y, color=MUTED, size=7, bold=False):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawRightString(x, y, text)

def pill(text, x, y, bg, fg, w=None, h=13, size=7):
    c.setFont("Helvetica-Bold", size)
    tw = c.stringWidth(text, "Helvetica-Bold", size)
    pw = w or (tw + 14)
    c.setFillColor(bg)
    c.roundRect(x, y - 3, pw, h, 5, fill=1, stroke=0)
    c.setFillColor(fg)
    c.drawString(x + (pw - tw) / 2, y + 1, text)

def hline(x, y, w, color=SLATE, lw=0.4):
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.line(x, y, x + w, y)

def stat_block(x, y, w, h, value, label_text, color, icon_char=""):
    card(x, y, w, h, fill=SURFACE2, border=color, radius=6)
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(x + w/2, y + h/2 + 2, f"{icon_char}{value}")
    c.setFillColor(TEXT2)
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(x + w/2, y + h/2 - 10, label_text.upper())

# ══════════════════════════════════════════════════════
# SECTION 1 — 3 KEY STATS BAR
# ══════════════════════════════════════════════════════
sy = H - 90
stat_h = 34
stat_w = (W - 28 - 8) / 3 - 4

for i, (val, lbl, col) in enumerate([
    ("2.2%",   "ROI Diario",        CYAN),
    ("$30,000","Bono Semanal Máx.", YELLOW),
    ("30 Niv.","Comisiones Red",    PINK),
]):
    sx = 14 + i * (stat_w + 6)
    stat_block(sx, sy - stat_h, stat_w, stat_h, val, lbl, col)

# ══════════════════════════════════════════════════════
# MAIN 3-COLUMN GRID
# ══════════════════════════════════════════════════════
MAIN_Y_TOP = sy - stat_h - 10
COL_W = (W - 28 - 8) / 3
col_xs = [14, 14 + COL_W + 4, 14 + (COL_W + 4) * 2]

# ── COLUMN 1: ROI DIARIO ─────────────────────────────
cx1 = col_xs[0]
ch1 = 220
card(cx1, MAIN_Y_TOP - ch1, COL_W, ch1, border_top_color=CYAN)

label("⚡  ROI DIARIO", cx1 + 10, MAIN_Y_TOP - 18, CYAN, 9, True)
label("Ganancia automática sobre tu inversión", cx1 + 10, MAIN_Y_TOP - 30, TEXT2, 7)
hline(cx1 + 10, MAIN_Y_TOP - 36, COL_W - 20, SLATE)

# Big number
c.setFillColor(CYAN)
c.setFont("Helvetica-Bold", 36)
c.drawCentredString(cx1 + COL_W/2, MAIN_Y_TOP - 72, "2.2%")
c.setFillColor(TEXT2)
c.setFont("Helvetica", 7.5)
c.drawCentredString(cx1 + COL_W/2, MAIN_Y_TOP - 84, "DIARIO SOBRE TU CAPITAL")

hline(cx1 + 10, MAIN_Y_TOP - 92, COL_W - 20, SLATE)

# Details grid
details = [
    ("Inversión Mín.", "$10 USDT"),
    ("Inversión Máx.", "$10,000 USDT"),
    ("Rendimiento",    "Hasta 200%"),
    ("Duración",       "91 días"),
    ("Pago",          "Diario automático"),
]
for i, (k, v) in enumerate(details):
    dy = MAIN_Y_TOP - 106 - i * 20
    label(k, cx1 + 10, dy, MUTED, 7)
    label_r(v, cx1 + COL_W - 10, dy, TEXT, 7, True)
    if i < len(details) - 1:
        hline(cx1 + 10, dy - 5, COL_W - 20, HexColor("#1e293b"))

# ── COLUMN 2: RED DE REFERIDOS ───────────────────────
cx2 = col_xs[1]
ch2 = 220
card(cx2, MAIN_Y_TOP - ch2, COL_W, ch2, border_top_color=PURPLE)

label("🌐  RED DE REFERIDOS", cx2 + 10, MAIN_Y_TOP - 18, PURPLE, 9, True)
label("Comisiones en 30 niveles de profundidad", cx2 + 10, MAIN_Y_TOP - 30, TEXT2, 7)
hline(cx2 + 10, MAIN_Y_TOP - 36, COL_W - 20, SLATE)

# Level table
levels = [
    ("Nivel 1",   "10%",  CYAN),
    ("Nivel 2",   "5%",   PURPLE),
    ("Nivel 3",   "3%",   PINK),
    ("Niveles 4–10", "2%",YELLOW),
    ("Niveles 11–20","1%",AMBER),
    ("Niveles 21–30","0.8%",GREEN),
]
for i, (lv, pct, col) in enumerate(levels):
    ly = MAIN_Y_TOP - 52 - i * 26
    # Row bg
    row_bg = HexColor("#0f172a") if i % 2 == 0 else SURFACE2
    c.setFillColor(row_bg)
    c.roundRect(cx2 + 8, ly - 7, COL_W - 16, 20, 4, fill=1, stroke=0)
    # Level bar fill
    try:
        bar_pct = float(pct.replace('%','')) / 10
    except:
        bar_pct = 0.1
    c.setFillColor(Color(col.red, col.green, col.blue, 0.25))
    c.roundRect(cx2 + 8, ly - 7, (COL_W - 16) * min(bar_pct, 1.0), 20, 4, fill=1, stroke=0)
    label(lv, cx2 + 14, ly + 3, TEXT2, 7)
    c.setFillColor(col)
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(cx2 + COL_W - 14, ly + 3, pct)

label("* % sobre inversión del referido", cx2 + 10, MAIN_Y_TOP - ch2 + 8, MUTED, 6)

# ── COLUMN 3: BONO SEMANAL ───────────────────────────
cx3 = col_xs[2]
ch3 = 220
card(cx3, MAIN_Y_TOP - ch3, COL_W, ch3, border_top_color=YELLOW)

label("🏆  BONO SEMANAL", cx3 + 10, MAIN_Y_TOP - 18, YELLOW, 9, True)
label("Basado en volumen de equipo · Domingos", cx3 + 10, MAIN_Y_TOP - 30, TEXT2, 7)
hline(cx3 + 10, MAIN_Y_TOP - 36, COL_W - 20, SLATE)

salary_rows = [
    ("$10K",   "$100"),
    ("$25K",   "$300"),
    ("$40K",   "$500"),
    ("$65K",   "$800"),
    ("$100K",  "$1,500"),
    ("$200K",  "$4,000"),
    ("$400K",  "$7,500"),
    ("$800K",  "$20,000"),
    ("$1M",    "$30,000"),
]
# Header row
c.setFillColor(HexColor("#1a1208"))
c.roundRect(cx3 + 8, MAIN_Y_TOP - 52, COL_W - 16, 14, 3, fill=1, stroke=0)
label("VOLUMEN EQUIPO", cx3 + 14, MAIN_Y_TOP - 48, YELLOW, 6, True)
label_r("BONO", cx3 + COL_W - 14, MAIN_Y_TOP - 48, YELLOW, 6, True)

for i, (vol, bonus) in enumerate(salary_rows):
    ry = MAIN_Y_TOP - 62 - i * 18
    row_bg = HexColor("#0f172a") if i % 2 == 0 else SURFACE2
    c.setFillColor(row_bg)
    c.roundRect(cx3 + 8, ry - 5, COL_W - 16, 16, 3, fill=1, stroke=0)
    label(vol, cx3 + 14, ry, TEXT2, 7)
    c.setFillColor(GREEN if i >= 4 else YELLOW)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawRightString(cx3 + COL_W - 14, ry, bonus)

label("Reclamable cada domingo 9AM-2PM UTC-4", cx3 + 10, MAIN_Y_TOP - ch3 + 8, MUTED, 6)

# ══════════════════════════════════════════════════════
# SECTION — BOTTOM ROW: 2 additional income streams
# ══════════════════════════════════════════════════════
B_TOP = MAIN_Y_TOP - ch1 - 10
COL_W2 = (W - 28) / 2 - 4

# ── LEFT: MERCADOS DE PREDICCIÓN ─────────────────────
bx1 = 14
bh = 80
card(bx1, B_TOP - bh, COL_W2, bh, border_top_color=GREEN)

label("📊  MERCADOS DE PREDICCIÓN", bx1 + 10, B_TOP - 18, GREEN, 8.5, True)
hline(bx1 + 10, B_TOP - 24, COL_W2 - 20, SLATE)

pred_items = [
    ("Categorías",   "Crypto · Deportes · Política · Tech · Economía"),
    ("Formato",      "Apuesta por opciones con pool compartido"),
    ("Ganancias",    "Proporcionales al pool ganador"),
    ("Fee casa",     "Configurable (defecto 2%)"),
]
for i, (k, v) in enumerate(pred_items):
    py = B_TOP - 36 - i * 12
    label(k + ":", py + 0.5, py - 0.5, MUTED, 6.5)
    label_r(v, bx1 + COL_W2 - 10, py - 0.5, TEXT2, 6.5)
    # fix: positional
    label(k + ":", bx1 + 10, py, MUTED, 6.5)
    label_r(v, bx1 + COL_W2 - 10, py, TEXT2, 6.5)

# ── RIGHT: SISTEMA DE PAGOS ──────────────────────────
bx2 = 14 + COL_W2 + 8
card(bx2, B_TOP - bh, COL_W2, bh, border_top_color=PINK)

label("💳  DEPÓSITOS & RETIROS", bx2 + 10, B_TOP - 18, PINK, 8.5, True)
hline(bx2 + 10, B_TOP - 24, COL_W2 - 20, SLATE)

pay_items = [
    ("Depósito Mín.",  "$25 USDT"),
    ("Depósito Máx.",  "$50,000 USDT"),
    ("Retiro Mín.",    "$25 USDT"),
    ("Fee Retiro",     "10%"),
    ("Métodos",        "Crypto (NowPayments) · Tarjeta (Stripe)"),
]
for i, (k, v) in enumerate(pay_items[:4]):
    ry2 = B_TOP - 36 - i * 11
    label(k + ":", bx2 + 10, ry2, MUTED, 6.5)
    label_r(v, bx2 + COL_W2 - 10, ry2, TEXT, 6.5, True)
# methods full width
label("Métodos:", bx2 + 10, B_TOP - 80, MUTED, 6.5)
label("Crypto (NowPayments) · Tarjeta (Stripe) · Manual", bx2 + 52, B_TOP - 80, TEXT2, 6.5)

# ══════════════════════════════════════════════════════
# SECTION — RANKS
# ══════════════════════════════════════════════════════
RK_TOP = B_TOP - bh - 10
rk_h = 46
card(14, RK_TOP - rk_h, W - 28, rk_h, fill=SURFACE2)

label("🎖  RANGOS", 24, RK_TOP - 14, TEXT2, 8, True)
hline(24, RK_TOP - 20, W - 48, SLATE)

ranks = [
    ("Starter",    HexColor("#94a3b8")),
    ("Bronze",     HexColor("#cd7f32")),
    ("Silver",     HexColor("#c0c0c0")),
    ("Gold",       HexColor("#fbbf24")),
    ("Platinum",   HexColor("#e5e4e2")),
    ("Diamond",    HexColor("#00f3ff")),
    ("Black Crown",HexColor("#c084fc")),
]
rk_w = (W - 48) / len(ranks)
for i, (name, col) in enumerate(ranks):
    rx = 24 + i * rk_w
    ry = RK_TOP - 40
    c.setFillColor(Color(col.red, col.green, col.blue, 0.15))
    c.roundRect(rx, ry, rk_w - 4, 16, 5, fill=1, stroke=0)
    c.setFillColor(col)
    c.setFont("Helvetica-Bold", 6.5)
    c.drawCentredString(rx + (rk_w - 4)/2, ry + 4, name)

# ══════════════════════════════════════════════════════
# FOOTER
# ══════════════════════════════════════════════════════
FT_Y = RK_TOP - rk_h - 8
card(14, FT_Y - 28, W - 28, 28, fill=SURFACE, border=SLATE)

# pills
pill_items = [
    ("✓  Sin Límite de Red",          HexColor("#0a2510"), GREEN),
    ("✓  Pagos en USDT",              HexColor("#1a1208"), YELLOW),
    ("✓  Dashboard Tiempo Real",      HexColor("#0f0720"), PINK),
    ("✓  Comisiones Instantáneas",    HexColor("#0a1e35"), CYAN),
    ("✓  Soporte 24/7 Telegram",      HexColor("#1a0a20"), PURPLE),
]
pill_gap = (W - 28 - 20) / len(pill_items)
for i, (txt, bg, fg) in enumerate(pill_items):
    px = 24 + i * pill_gap
    pill(txt, px, FT_Y - 18, bg, fg, w=pill_gap - 6, h=14, size=6.5)

# ── Bottom credit line ──────────────────────────────
c.setFillColor(MUTED)
c.setFont("Helvetica", 6)
c.drawCentredString(W/2, FT_Y - 36, "proyecto-x-user.vercel.app  ·  Los porcentajes son referenciales y pueden variar según los parámetros del sistema  ·  © 2025 PROYECTO X")

c.save()
print("PDF generado:", OUT)
