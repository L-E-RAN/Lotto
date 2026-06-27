// מנתח את עמוד התוצאות של lotteryextreme (גם בגרסת Wayback).
// מבנה: "Lotto &nbsp; DD.MM.YYYY Day - Draw NNNN" ואז <ul class='displayball'><li>n×6<li class="dbx"><li>strong</ul>
export function parseLotteryExtreme(html) {
  const out = [];
  if (!html) return out;
  const re = /Lotto\s*&nbsp;\s*(\d{2}\.\d{2}\.\d{4})[^<]*-\s*Draw\s*(\d+)\s*<\/tr>\s*<TR>\s*<TD[^>]*>\s*<ul[^>]*>(.*?)<\/ul>/gis;
  let m;
  while ((m = re.exec(html))) {
    const date = m[1];
    const drawNumber = parseInt(m[2], 10);
    const nums = [...m[3].matchAll(/<li[^>]*>\s*(\d{1,2})/g)].map((x) => parseInt(x[1], 10));
    if (nums.length >= 7) {
      const main = nums.slice(0, 6);
      const strong = nums[6];
      if (main.every((n) => n >= 1 && n <= 37) && strong >= 1 && strong <= 7) {
        out.push({ draw_number: drawNumber, date, numbers: main, strong });
      }
    }
  }
  return out;
}

// DD.MM.YYYY → YYYY-MM-DD
export function deDot(s) {
  const m = String(s).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}
