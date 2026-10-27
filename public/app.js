/* ReceiptSafe (cloud). Students sign in and keep their own receipts. Data lives in Supabase. */
(() => {
'use strict';

const BUCKET = 'receipts';
const CATEGORIES = ['Tuition', 'Laboratory Fee', 'School Activity', 'Organization Fee', 'Books & Uniform', 'Exam Fee', 'Other'];

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');

/* ---------- small helpers ---------- */
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage full or blocked */ } };
const lsDel = k => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
const lsJSON = k => { try { return JSON.parse(lsGet(k)); } catch { return null; } };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad2 = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const uid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
const errText = e => (e && (e.message || e.error_description)) || t('err.generic');
const isNetErr = e => !navigator.onLine ||
  /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|err_network|timed? ?out/i.test(String((e && e.message) || e || ''));

/* ---------- language ---------- */
const DICT = {
  en: {
    tagline: 'Your payments, always within reach.', loading: 'Loading…', addReceipt: '+ Add Receipt',
    'tab.dashboard': 'Dashboard', 'tab.receipts': 'Receipts', 'tab.account': 'Account',
    'auth.login': 'Log in', 'auth.register': 'Register', 'auth.fullName': 'Full name',
    'auth.email': 'Email', 'auth.password': 'Password', 'auth.pwHint': 'At least 8 characters.',
    'auth.create': 'Create account', 'auth.forgot': 'Forgot password?',
    'auth.privacy': 'Your receipts are private. Only you can see them.',
    'auth.needEmail': 'Enter your email first, then tap "Forgot password?".',
    'auth.resetSent': 'If that email has an account, a reset link is on its way.',
    'auth.enterBoth': 'Enter your email and password.', 'auth.wrong': 'Wrong email or password.',
    'auth.confirm': 'Confirm your email first. Check your inbox for the link.',
    'auth.needNameId': 'Enter your full name.', 'auth.pwShort': 'Use a password with at least 8 characters.',
   
    'auth.created': 'Account created. Check your email to confirm it, then log in.',
    'auth.showPw': 'Show password', 'auth.hidePw': 'Hide password', 'auth.newPwTitle': 'Choose a new password',
    'auth.newPw': 'New password', 'auth.savePw': 'Save password', 'auth.pwUpdated': 'Password updated',
    'auth.offline': "You're offline. Connect to the internet to log in.",
    'status.queued': 'Waiting to upload',
    'cat.Tuition': 'Tuition', 'cat.Laboratory Fee': 'Laboratory Fee', 'cat.School Activity': 'School Activity',
    'cat.Organization Fee': 'Organization Fee', 'cat.Books & Uniform': 'Books & Uniform', 'cat.Exam Fee': 'Exam Fee', 'cat.Other': 'Other',
    'dash.welcome': 'Welcome back, {name}', 'dash.welcome0': 'Welcome back',
    'stat.total': 'Total recorded', 'stat.month': 'This month', 'stat.count': 'Receipts',
   
   
    'chart.byMonth': 'Spending by month', 'chart.m6': '6 months', 'chart.m12': '12 months', 'chart.byCat': 'By category',
    'chart.empty': 'Add a receipt to see your spending chart.',
    'dash.recent': 'Recent receipts', 'dash.none': 'No receipts yet.', 'dash.noneHint': 'Tap + Add Receipt after your next payment.',
    'list.title': 'Receipts', 'list.search': 'Search description or receipt no.', 'list.allCats': 'All categories',
    'list.from': 'From', 'list.to': 'To', 'list.new': 'Newest first', 'list.old': 'Oldest first',
    'list.hi': 'Highest amount', 'list.none': 'No matching receipts.',
    'rec.back': '← Back', 'rec.date': 'Date paid', 'rec.cat': 'Category', 'rec.no': 'Receipt no.',
    'rec.status': 'Status', 'rec.notes': 'Notes', 'rec.noPhoto': 'No photo attached.', 'rec.noPhotoShort': 'No photo',
    'rec.download': 'Download', 'rec.print': 'Print', 'rec.edit': 'Edit', 'rec.delete': 'Delete',
   
   
    'rec.confirmDelete': 'Delete this receipt? This cannot be undone.', 'rec.deleted': 'Receipt deleted', 'rec.deleteFail': 'Could not delete. Your account has no permission to delete this receipt.',
    'rec.notFound': 'Receipt not found.', 'rec.downloadFail': 'Could not download the photo', 'rec.viewLarge': 'View photo large',
    'rec.close': 'Close photo', 'rec.enlarged': 'Receipt photo, enlarged', 'rec.alt': 'Receipt photo',
    'form.add': 'Add receipt', 'form.edit': 'Edit receipt', 'form.desc': 'Payment description', 'form.descPh': 'e.g. Sports Fest Fee',
    'form.amount': 'Amount (₱)', 'form.date': 'Date of payment', 'form.cat': 'Payment category', 'form.no': 'Receipt number',
    'form.noHint': '(as printed on the receipt)', 'form.notes': 'Notes', 'form.optional': '(optional)', 'form.photo': 'Receipt photo',
    'form.take': 'Take a photo', 'form.choose': 'Choose from phone', 'form.editPhoto': 'Edit photo', 'form.autofill': 'Auto-fill from photo',
    'form.noPhoto': 'No photo chosen yet.', 'form.photoKept': 'Current photo kept. Pick another to replace it.',
    'form.submit': 'Submit receipt', 'form.saveResubmit': 'Save and resubmit', 'form.cancel': 'Cancel',
   
    'form.errDesc': 'Please enter a description.', 'form.errAmount': 'Please enter an amount greater than zero.',
    'form.errDate': 'Please choose the payment date.', 'form.errPhoto': 'Please add a photo of the receipt.',
    'form.similar': 'A similar receipt already exists ("{d}", {a}). Save anyway?', 'form.saveAnyway': 'Save anyway',
    'form.submitted': 'Receipt saved', 'form.resubmitted': 'Receipt updated', 'form.couldNot': 'Could not save: {m}',
    'err.notImage': 'That file is not a readable image', 'err.process': 'Could not process the image', 'err.generic': 'Something went wrong. Please try again.',
    'ed.title': 'Edit photo', 'ed.hint': 'Drag the box to crop it, and the corners to resize. Crop close to the receipt for the clearest text.', 'ed.left': 'Rotate left', 'ed.right': 'Rotate right',
    'ed.reset': 'Reset crop', 'ed.original': 'Original', 'ed.doc': 'Document (clearer text)', 'ed.bright': 'Brightness', 'ed.contrast': 'Contrast',
    'ed.use': 'Use photo', 'ed.cancel': 'Cancel',
    'ocr.pct': 'Reading the photo… {p}%', 'ocr.reading': 'Reading the photo…',
    'ocr.done': 'Filled in {n} box(es) from the photo. Please check each one.',
    'ocr.nothing': 'Could not read any details. Please type them in.', 'ocr.needNet': 'Auto-fill needs internet the first time.',
    'ocr.fail': 'Could not read the photo. Please type the details.', 'ocr.firstTime': 'The first use downloads about 10 MB.',
    'net.offline': "You're offline. New receipts are saved on this phone and upload when you're back online.",
    'net.saved': "Saved on this phone. It will upload when you're online.",
    'net.uploaded.1': '{n} saved receipt uploaded', 'net.uploaded.n': '{n} saved receipts uploaded',
    'net.waiting.1': '{n} receipt is waiting to upload.', 'net.waiting.n': '{n} receipts are waiting to upload.',
    'net.uploadNow': 'Upload now', 'net.uploading': 'Uploading…', 'net.stillWaiting': "Could not upload yet. We'll try again when you're online.",
    'net.queuedNote': "This receipt is saved only on this phone until it uploads. Don't clear your browser data.",
    'net.showingSaved': "You're offline. Showing your last saved list.", 'net.needNet': "This needs internet. Try again when you're online.",
    'net.editNeedsNet': 'Editing needs internet.', 'net.cantReach': 'Cannot reach the server. Check your internet connection and reload.',
    'net.queueFail': 'Could not upload: {m}',
    'tab.fees': 'Fees', 'fee.title': 'School fee calculator', 'fee.add': 'Add fee', 'fee.edit': 'Edit fee', 'fee.name': 'Fee name', 'fee.namePh': 'e.g. Tuition, Math 101 lab', 'fee.term': 'Semester / term', 'fee.termPh': 'e.g. 1st Sem 2026-27', 'fee.tag': 'Subject or event (optional)', 'fee.tagPh': 'e.g. Math 101, Sports Fest', 'fee.official': 'Official (from school)', 'fee.officialHint': 'Tick this only if the amount comes from your school (assessment or billing statement). Otherwise it counts as an estimate.', 'fee.est': 'Estimate', 'fee.mixed': 'Partly official', 'fee.none': 'Not set', 'fee.expected': 'Total expected fees', 'fee.paid': 'Total recorded payments', 'fee.balance': 'Remaining balance', 'fee.progress': 'Payment progress', 'fee.balEst': 'Estimated balance', 'fee.balOfficial': 'Balance (official fees)', 'fee.estNote': 'This is an estimate. It uses the fees you entered and the receipts you saved, not a balance confirmed by your school.', 'fee.officialNote': 'All fees are marked official. Receipts are still matched by category, so confirm with your school before relying on it.', 'fee.by': 'Breakdown', 'fee.byTerm': 'Semester', 'fee.byCat': 'Category', 'fee.byTag': 'Subject / event', 'fee.of': '{p} of {e}', 'fee.left': '{a} left', 'fee.settled': 'Fully paid', 'fee.empty': 'Add the fees you expect to pay this school year to see what is left.', 'fee.emptyHint': 'Add each fee with its amount. Receipts are matched to fees by category, oldest payment first.', 'fee.unassigned': '{a} in your receipts does not match any fee category yet.', 'fee.list': 'Your fees', 'fee.school': 'Balance from school', 'fee.schoolSet': 'Enter school balance', 'fee.schoolAsk': 'Balance (₱) shown by your school or cashier.', 'fee.schoolHint': 'Have a statement from the school? Enter its balance to compare with this calculator.', 'fee.schoolAsOf': 'As of {d}', 'fee.match': 'Matches the calculator.', 'fee.diff': 'Differs from the calculator by {a}. Check your receipts and fees, or ask the school.', 'fee.clear': 'Clear', 'fee.errName': 'Enter a fee name.', 'fee.errAmt': 'Enter an amount greater than zero.', 'fee.saved': 'Fee saved', 'fee.removed': 'Fee removed', 'fee.mini': 'Remaining school fees', 'fee.device': 'Fees are saved to your account and follow you to your other devices.', 'fee.auto': 'Automatic (oldest unpaid first)', 'fee.pick': 'Counts toward fee', 'fee.pickHint': 'Choose a fee if this payment is for a specific semester or subject.', 'fee.afterLeft': '{c}: {a} left to pay', 'fee.afterDone': '{c}: fully paid', 'fee.dueLabel': 'Due date (optional)', 'fee.dueOn': 'Due {d}',
    'al.title': 'Notifications', 'al.none': 'You are all caught up.', 'al.done': 'Done',
    'al.budget80': 'You have used {p}% of your monthly budget. {a} left.',
    'al.due': '{n} is due in {d} days. {a} still unpaid.', 'al.dueToday': '{n} is due today. {a} still unpaid.', 'al.overdue': '{n} was due {d} days ago. {a} still unpaid.',
    'al.phone': 'Phone alerts', 'al.phoneOn': 'Turn on phone alerts', 'al.phoneOff': 'Turn off phone alerts', 'al.phoneOnMsg': 'Phone alerts are on',
    'al.pushNote': 'You will get alerts even when the app is closed, once a day (around 9 AM).', 'al.pushFail': 'Could not turn on phone alerts: {m}',
    'al.phoneDenied': 'Notifications are blocked in your browser settings.',
    'al.phoneNote': 'Alerts appear when you open the app. Alerts while the app is closed need a push server, which this app does not have yet.',
    'goal.title': 'Monthly budget', 'goal.set': 'Set budget', 'goal.edit': 'Edit', 'goal.save': 'Save',
    'goal.hint': 'Set a monthly limit to see how much room you have left.', 'goal.ask': 'Monthly budget (₱). Enter 0 to remove it.',
    'goal.left': '{a} left this month.', 'goal.over': '{a} over budget this month.', 'goal.vsLast': 'vs last month',
    'list.export': 'Export CSV', 'list.sum': '{n} shown · {a}', 'rec.share': 'Share', 'rec.dup': 'Duplicate', 'rec.shareFail': 'Could not share the photo',
   
   
   
   
   
   
   
   
    'acct.title': 'Account', 'acct.email': 'Email',
    'acct.fullName': 'Full name', 'acct.saveName': 'Save name', 'acct.saved': 'Name saved', 'acct.logout': 'Log out',
    'acct.prefs': 'Preferences', 'acct.lang': 'Language', 'acct.theme': 'Appearance', 'acct.auto': 'Auto', 'acct.light': 'Light', 'acct.dark': 'Dark',
    wrong: 'Something went wrong: {m}', retry: 'Try again', cancel: 'Cancel',
    'theme.toLight': 'Switch to light mode', 'theme.toDark': 'Switch to dark mode', 'lang.switch': 'Change language'
  },
  fil: {
    tagline: 'Ang mga bayad mo, laging abot-kamay.', loading: 'Naglo-load…', addReceipt: '+ Magdagdag ng Resibo',
    'tab.dashboard': 'Dashboard', 'tab.receipts': 'Mga Resibo', 'tab.account': 'Account',
    'auth.login': 'Mag-log in', 'auth.register': 'Magparehistro', 'auth.fullName': 'Buong pangalan',
    'auth.email': 'Email', 'auth.password': 'Password', 'auth.pwHint': 'Hindi bababa sa 8 character.',
    'auth.create': 'Gumawa ng account', 'auth.forgot': 'Nakalimutan ang password?',
    'auth.privacy': 'Pribado ang mga resibo mo. Ikaw lang ang makakakita.',
    'auth.needEmail': 'Ilagay muna ang email mo, tapos pindutin ang "Nakalimutan ang password?".',
    'auth.resetSent': 'Kung may account ang email na iyon, may ipapadala kaming link para i-reset ang password.',
    'auth.enterBoth': 'Ilagay ang email at password mo.', 'auth.wrong': 'Mali ang email o password.',
    'auth.confirm': 'Kumpirmahin muna ang email mo. Tingnan ang inbox para sa link.',
    'auth.needNameId': 'Ilagay ang buong pangalan mo.', 'auth.pwShort': 'Gumamit ng password na may hindi bababa sa 8 character.',
   
    'auth.created': 'Nagawa na ang account. Kumpirmahin ang email mo, tapos mag-log in.',
    'auth.showPw': 'Ipakita ang password', 'auth.hidePw': 'Itago ang password', 'auth.newPwTitle': 'Pumili ng bagong password',
    'auth.newPw': 'Bagong password', 'auth.savePw': 'I-save ang password', 'auth.pwUpdated': 'Na-update ang password',
    'auth.offline': 'Offline ka. Kailangan ng internet para mag-log in.',
    'status.queued': 'Naghihintay ma-upload',
    'cat.Tuition': 'Matrikula', 'cat.Laboratory Fee': 'Bayad sa Laboratoryo', 'cat.School Activity': 'Aktibidad sa Paaralan',
    'cat.Organization Fee': 'Bayad sa Organisasyon', 'cat.Books & Uniform': 'Libro at Uniporme', 'cat.Exam Fee': 'Bayad sa Pagsusulit', 'cat.Other': 'Iba pa',
    'dash.welcome': 'Kumusta, {name}', 'dash.welcome0': 'Kumusta',
    'stat.total': 'Kabuuang naitala', 'stat.month': 'Ngayong buwan', 'stat.count': 'Mga resibo',
   
   
    'chart.byMonth': 'Gastos kada buwan', 'chart.m6': '6 na buwan', 'chart.m12': '12 buwan', 'chart.byCat': 'Ayon sa category',
    'chart.empty': 'Magdagdag ng resibo para makita ang chart ng gastos mo.',
    'dash.recent': 'Mga huling resibo', 'dash.none': 'Wala ka pang resibo.', 'dash.noneHint': 'Pindutin ang + Magdagdag ng Resibo pagkatapos ng susunod mong bayad.',
    'list.title': 'Mga Resibo', 'list.search': 'Hanapin ang description o receipt no.', 'list.allCats': 'Lahat ng category',
    'list.from': 'Mula', 'list.to': 'Hanggang', 'list.new': 'Pinakabago muna', 'list.old': 'Pinakaluma muna',
    'list.hi': 'Pinakamataas na halaga', 'list.none': 'Walang tugmang resibo.',
    'rec.back': '← Bumalik', 'rec.date': 'Petsa ng bayad', 'rec.cat': 'Category', 'rec.no': 'Receipt no.',
    'rec.status': 'Status', 'rec.notes': 'Mga tala', 'rec.noPhoto': 'Walang nakalakip na litrato.', 'rec.noPhotoShort': 'Walang litrato',
    'rec.download': 'I-download', 'rec.print': 'I-print', 'rec.edit': 'I-edit', 'rec.delete': 'Burahin',
   
   
    'rec.confirmDelete': 'Buburahin ang resibong ito? Hindi na ito maibabalik.', 'rec.deleted': 'Nabura ang resibo', 'rec.deleteFail': 'Hindi nabura. Walang pahintulot ang account mo na burahin ang resibong ito.',
    'rec.notFound': 'Hindi nahanap ang resibo.', 'rec.downloadFail': 'Hindi ma-download ang litrato', 'rec.viewLarge': 'Tingnan ang litrato nang malaki',
    'rec.close': 'Isara ang litrato', 'rec.enlarged': 'Pinalaking litrato ng resibo', 'rec.alt': 'Litrato ng resibo',
    'form.add': 'Magdagdag ng resibo', 'form.edit': 'I-edit ang resibo', 'form.desc': 'Description ng bayad', 'form.descPh': 'hal. Sports Fest Fee',
    'form.amount': 'Halaga (₱)', 'form.date': 'Petsa ng bayad', 'form.cat': 'Category ng bayad', 'form.no': 'Receipt number',
    'form.noHint': '(ayon sa nakalimbag sa resibo)', 'form.notes': 'Mga tala', 'form.optional': '(hindi kailangan)', 'form.photo': 'Litrato ng resibo',
    'form.take': 'Kumuha ng litrato', 'form.choose': 'Pumili sa phone', 'form.editPhoto': 'I-edit ang litrato', 'form.autofill': 'Auto-fill mula sa litrato',
    'form.noPhoto': 'Wala pang napiling litrato.', 'form.photoKept': 'Pinanatili ang kasalukuyang litrato. Pumili ng bago kung papalitan.',
    'form.submit': 'Isumite ang resibo', 'form.saveResubmit': 'I-save at isumite ulit', 'form.cancel': 'Kanselahin',
   
    'form.errDesc': 'Maglagay ng description.', 'form.errAmount': 'Maglagay ng halagang higit sa zero.',
    'form.errDate': 'Piliin ang petsa ng bayad.', 'form.errPhoto': 'Magdagdag ng litrato ng resibo.',
    'form.similar': 'May kahawig nang resibo ("{d}", {a}). I-save pa rin?', 'form.saveAnyway': 'I-save pa rin',
    'form.submitted': 'Na-save ang resibo', 'form.resubmitted': 'Na-update ang resibo', 'form.couldNot': 'Hindi ma-save: {m}',
    'err.notImage': 'Hindi mabasa ang file na iyon bilang litrato', 'err.process': 'Hindi maproseso ang litrato', 'err.generic': 'May nangyaring mali. Subukan ulit.',
    'ed.title': 'I-edit ang litrato', 'ed.hint': 'I-drag ang kahon para i-crop at ang mga sulok para palitan ang laki. I-crop nang malapit sa resibo para mas malinaw ang teksto.', 'ed.left': 'I-ikot pakaliwa', 'ed.right': 'I-ikot pakanan',
    'ed.reset': 'I-reset ang crop', 'ed.original': 'Orihinal', 'ed.doc': 'Dokumento (mas malinaw)', 'ed.bright': 'Liwanag', 'ed.contrast': 'Contrast',
    'ed.use': 'Gamitin ang litrato', 'ed.cancel': 'Kanselahin',
    'ocr.pct': 'Binabasa ang litrato… {p}%', 'ocr.reading': 'Binabasa ang litrato…',
    'ocr.done': 'Napunan ang {n} na kahon mula sa litrato. Pakisuri ang bawat isa.',
    'ocr.nothing': 'Walang nabasang detalye. I-type na lang ang mga ito.', 'ocr.needNet': 'Kailangan ng internet ang auto-fill sa unang gamit.',
    'ocr.fail': 'Hindi nabasa ang litrato. I-type na lang ang mga detalye.', 'ocr.firstTime': 'Sa unang gamit, magda-download ito ng mga 10 MB.',
    'net.offline': 'Offline ka. Ise-save ang mga bagong resibo sa phone na ito at ia-upload kapag may internet na.',
    'net.saved': 'Na-save sa phone na ito. Ia-upload kapag may internet na.',
    'net.uploaded.1': 'Na-upload ang {n} naka-save na resibo', 'net.uploaded.n': 'Na-upload ang {n} naka-save na resibo',
    'net.waiting.1': '{n} resibo ang naghihintay ma-upload.', 'net.waiting.n': '{n} resibo ang naghihintay ma-upload.',
    'net.uploadNow': 'I-upload na ngayon', 'net.uploading': 'Ina-upload…', 'net.stillWaiting': 'Hindi pa ma-upload. Susubukan ulit kapag may internet na.',
    'net.queuedNote': 'Sa phone mo lang naka-save ang resibong ito hanggang ma-upload. Huwag burahin ang browser data.',
    'net.showingSaved': 'Offline ka. Ipinapakita ang huling naka-save na listahan.', 'net.needNet': 'Kailangan ng internet nito. Subukan ulit kapag online ka na.',
    'net.editNeedsNet': 'Kailangan ng internet para mag-edit.', 'net.cantReach': 'Hindi maabot ang server. Tingnan ang internet at i-reload.',
    'net.queueFail': 'Hindi ma-upload: {m}',
    'tab.fees': 'Mga Bayarin', 'fee.title': 'Calculator ng school fees', 'fee.add': 'Magdagdag ng bayarin', 'fee.edit': 'I-edit ang bayarin', 'fee.name': 'Pangalan ng bayarin', 'fee.namePh': 'hal. Matrikula, Math 101 lab', 'fee.term': 'Semestre / term', 'fee.termPh': 'hal. 1st Sem 2026-27', 'fee.tag': 'Subject o event (hindi kailangan)', 'fee.tagPh': 'hal. Math 101, Sports Fest', 'fee.official': 'Opisyal (galing sa school)', 'fee.officialHint': 'I-tick lang kung galing sa school ang halaga (assessment o billing statement). Kung hindi, tantiya lang ito.', 'fee.est': 'Tantiya', 'fee.mixed': 'Bahagyang opisyal', 'fee.none': 'Wala pa', 'fee.expected': 'Kabuuang inaasahang bayarin', 'fee.paid': 'Kabuuang naitalang bayad', 'fee.balance': 'Natitirang balanse', 'fee.progress': 'Progreso ng bayad', 'fee.balEst': 'Tantiyang balanse', 'fee.balOfficial': 'Balanse (opisyal na bayarin)', 'fee.estNote': 'Tantiya lang ito. Batay ito sa mga bayaring inilagay mo at mga resibong na-save mo, hindi sa balanseng kumpirmado ng school.', 'fee.officialNote': 'Opisyal ang lahat ng bayarin. Itinutugma pa rin ang mga resibo ayon sa category, kaya kumpirmahin sa school bago umasa dito.', 'fee.by': 'Hati-hati', 'fee.byTerm': 'Semestre', 'fee.byCat': 'Category', 'fee.byTag': 'Subject / event', 'fee.of': '{p} sa {e}', 'fee.left': '{a} ang natitira', 'fee.settled': 'Bayad na lahat', 'fee.empty': 'Idagdag ang mga bayaring inaasahan mo ngayong school year para makita ang natitira.', 'fee.emptyHint': 'Ilagay ang bawat bayarin at halaga nito. Itinutugma ang mga resibo sa bayarin ayon sa category, mula sa pinakaunang bayad.', 'fee.unassigned': '{a} sa mga resibo mo ang walang katugmang category ng bayarin.', 'fee.list': 'Mga bayarin mo', 'fee.school': 'Balanse mula sa school', 'fee.schoolSet': 'Ilagay ang balanse ng school', 'fee.schoolAsk': 'Balanse (₱) na nakasaad sa school o cashier.', 'fee.schoolHint': 'May statement mula sa school? Ilagay ang balanse para ihambing sa calculator.', 'fee.schoolAsOf': 'Hanggang {d}', 'fee.match': 'Tugma sa calculator.', 'fee.diff': 'Iba ng {a} sa calculator. Suriin ang mga resibo at bayarin, o magtanong sa school.', 'fee.clear': 'Alisin', 'fee.errName': 'Maglagay ng pangalan ng bayarin.', 'fee.errAmt': 'Maglagay ng halagang higit sa zero.', 'fee.saved': 'Na-save ang bayarin', 'fee.removed': 'Naalis ang bayarin', 'fee.mini': 'Natitirang school fees', 'fee.device': 'Naka-save sa account mo ang mga bayarin at sumusunod sa iba mong device.', 'fee.auto': 'Awtomatiko (pinakaunang hindi pa bayad)', 'fee.pick': 'Mapupunta sa bayarin', 'fee.pickHint': 'Pumili ng bayarin kung para sa partikular na semestre o subject ang bayad na ito.', 'fee.afterLeft': '{c}: {a} ang natitira', 'fee.afterDone': '{c}: bayad na lahat', 'fee.dueLabel': 'Due date (hindi kailangan)', 'fee.dueOn': 'Due sa {d}',
    'al.title': 'Mga abiso', 'al.none': 'Wala kang kailangang asikasuhin.', 'al.done': 'Tapos na',
    'al.budget80': 'Nagamit mo na ang {p}% ng budget mo kada buwan. {a} ang natitira.',
    'al.due': 'Due na ang {n} sa loob ng {d} araw. {a} ang hindi pa bayad.', 'al.dueToday': 'Due na ngayon ang {n}. {a} ang hindi pa bayad.', 'al.overdue': 'Lampas na ng {d} araw ang due ng {n}. {a} ang hindi pa bayad.',
    'al.phone': 'Alerto sa phone', 'al.phoneOn': 'I-on ang alerto sa phone', 'al.phoneOff': 'I-off ang alerto sa phone', 'al.phoneOnMsg': 'Naka-on na ang alerto sa phone',
    'al.pushNote': 'Makakatanggap ka ng alerto kahit sarado ang app, isang beses kada araw (mga 9 AM).', 'al.pushFail': 'Hindi ma-on ang alerto sa phone: {m}',
    'al.phoneDenied': 'Naka-block ang notifications sa settings ng browser mo.',
    'al.phoneNote': 'Lalabas ang mga alerto kapag binuksan mo ang app. Para lumabas kahit sarado ang app, kailangan ng push server na wala pa sa app na ito.',
    'goal.title': 'Budget kada buwan', 'goal.set': 'Magtakda ng budget', 'goal.edit': 'I-edit', 'goal.save': 'I-save',
    'goal.hint': 'Magtakda ng limit kada buwan para makita kung magkano pa ang natitira.', 'goal.ask': 'Budget kada buwan (₱). Ilagay ang 0 para alisin.',
    'goal.left': '{a} ang natitira ngayong buwan.', 'goal.over': 'Lampas ng {a} sa budget ngayong buwan.', 'goal.vsLast': 'kumpara noong nakaraang buwan',
    'list.export': 'I-export ang CSV', 'list.sum': '{n} ang ipinapakita · {a}', 'rec.share': 'I-share', 'rec.dup': 'I-duplicate', 'rec.shareFail': 'Hindi ma-share ang litrato',
   
   
   
   
   
   
   
   
    'acct.title': 'Account', 'acct.email': 'Email',
    'acct.fullName': 'Buong pangalan', 'acct.saveName': 'I-save ang pangalan', 'acct.saved': 'Na-save ang pangalan', 'acct.logout': 'Mag-log out',
    'acct.prefs': 'Mga setting', 'acct.lang': 'Wika', 'acct.theme': 'Itsura', 'acct.auto': 'Auto', 'acct.light': 'Maliwanag', 'acct.dark': 'Madilim',
    wrong: 'May nangyaring mali: {m}', retry: 'Subukan ulit', cancel: 'Kanselahin',
    'theme.toLight': 'Lumipat sa maliwanag na itsura', 'theme.toDark': 'Lumipat sa madilim na itsura', 'lang.switch': 'Palitan ang wika'
  }
};
let lang = lsGet('rs-lang') || (/^(fil|tl)/i.test(navigator.language || '') ? 'fil' : 'en');
if (!DICT[lang]) lang = 'en';
const t = (k, p) => {
  let s = DICT[lang][k] ?? DICT.en[k] ?? k;
  if (p) for (const [a, b] of Object.entries(p)) s = s.split('{' + a + '}').join(b);
  return s;
};
const tn = (k, n, p = {}) => t(k + (n === 1 ? '.1' : '.n'), { n, ...p });
const tH = (k, p) => t(k, p && Object.fromEntries(Object.entries(p).map(([a, b]) => [a, esc(b)])));
const loc = () => (lang === 'fil' ? 'fil-PH' : 'en-PH');
const peso = n => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString(loc(), { year: 'numeric', month: 'short', day: 'numeric' });
const catName = c => { const k = 'cat.' + c; return DICT[lang][k] || c; };

/* ---------- theme ---------- */
let theme = lsGet('rs-theme') || 'auto';
const sysDark = () => !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
const effTheme = () => (theme === 'auto' ? (sysDark() ? 'dark' : 'light') : theme);
function applyTheme() {
  const r = document.documentElement;
  if (theme === 'light' || theme === 'dark') r.setAttribute('data-theme', theme); else r.removeAttribute('data-theme');
}
function setTheme(m) { theme = m; lsSet('rs-theme', m); applyTheme(); applyStatic(); }
function setLang(l) {
  lang = l; lsSet('rs-lang', l); applyStatic(); if (sb) render();
  try { if (sb && session) sb.from('user_prefs').update({ lang: l }).eq('user_id', session.user.id).then(() => {}, () => {}); } catch { /* optional */ }
}

const MOON = 'M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z';
const SUN = 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM2 13h2a1 1 0 0 0 0-2H2a1 1 0 0 0 0 2zm18 0h2a1 1 0 0 0 0-2h-2a1 1 0 0 0 0 2zM11 2v2a1 1 0 0 0 2 0V2a1 1 0 0 0-2 0zm0 18v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-2 0zM5.99 4.58a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41L5.99 4.58zm12.37 12.37a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41l-1.06-1.06zm1.06-10.96a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41l1.06-1.06zM7.05 18.36a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41l1.06-1.06z';

function applyStatic() {
  document.documentElement.lang = lang === 'fil' ? 'fil' : 'en';
  $('#tag').textContent = t('tagline');
  $('#fab').textContent = t('addReceipt');
  if (bellEl()) { bellEl().setAttribute('aria-label', t('al.title')); bellEl().title = t('al.title'); }
  const bl = $('#btnLang'); bl.textContent = lang === 'fil' ? 'FIL' : 'EN'; bl.setAttribute('aria-label', t('lang.switch')); bl.title = t('lang.switch');
  const dark = effTheme() === 'dark', bt = $('#btnTheme');
  bt.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="${dark ? SUN : MOON}"/></svg>`;
  bt.setAttribute('aria-label', dark ? t('theme.toLight') : t('theme.toDark')); bt.title = bt.getAttribute('aria-label');
  updateNet();
}
$('#btnLang').addEventListener('click', () => setLang(lang === 'fil' ? 'en' : 'fil'));
$('#btnTheme').addEventListener('click', () => setTheme(effTheme() === 'dark' ? 'light' : 'dark'));

/* ---------- ui helpers ---------- */
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 3000);
}
function ask(msg, ok = 'OK', danger = true) {
  return new Promise(res => {
    const d = $('#dlg');
    d.innerHTML = `<p style="margin:0 0 16px">${esc(msg)}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" id="no">${esc(t('cancel'))}</button><button class="btn ${danger ? 'danger' : ''}" id="yes">${esc(ok)}</button></div>`;
    let done = false;
    const fin = v => { if (done) return; done = true; if (d.open) d.close(); res(v); };
    $('#yes').onclick = () => fin(true); $('#no').onclick = () => fin(false);
    d.onclose = () => fin(false);
    d.showModal();
  });
}
const blobUrls = [];
const localUrl = b => { const u = URL.createObjectURL(b); blobUrls.push(u); return u; };
const freeUrls = () => { while (blobUrls.length) URL.revokeObjectURL(blobUrls.pop()); };

const EYE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5ZM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7ZM2 4.27l2.28 2.28.46.46A11.8 11.8 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27ZM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2Zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01Z"/></svg>';

function pwField(id, autocomplete) {
  return `<div class="pwwrap"><input id="${id}" type="password" autocomplete="${autocomplete}" required minlength="8">
    <button type="button" class="pweye" data-for="${id}" aria-label="${esc(t('auth.showPw'))}" aria-pressed="false">${EYE}</button></div>`;
}
function bindPw() {
  view.querySelectorAll('.pweye').forEach(b => b.onclick = () => {
    const input = $('#' + b.dataset.for), show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.innerHTML = show ? EYE_OFF : EYE;
    b.setAttribute('aria-label', show ? t('auth.hidePw') : t('auth.showPw'));
    b.setAttribute('aria-pressed', String(show));
    input.focus();
  });
}

/* big photo viewer. The page behind it is blurred. */
function openPhoto(src) {
  let d = $('#lightbox');
  if (!d) { d = document.createElement('dialog'); d.id = 'lightbox'; d.className = 'lightbox'; document.body.appendChild(d); }
  d.innerHTML = `<button type="button" class="lb-close" aria-label="${esc(t('rec.close'))}"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"/></svg></button><img alt="${esc(t('rec.enlarged'))}" src="${esc(src)}">`;
  d.onclick = e => { if (e.target.tagName !== 'IMG') d.close(); };
  d.onclose = () => { d.innerHTML = ''; };
  d.showModal();
}
function bindPhoto() {
  const img = $('#pimg'), btn = $('#viewphoto');
  if (!img) return;
  img.onclick = () => openPhoto(img.src);
  if (btn) btn.onclick = () => openPhoto(img.src);
}

/* ---------- image tools (used by the photo editor) ---------- */
function loadImageToCanvas(file, max = 2000) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error(t('err.notImage'))); };
    img.src = url;
  });
}
function scaleCanvas(src, max) {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  if (k === 1) return src;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}
function rotateCanvas(src, deg) {
  const w = src.width, h = src.height, swap = deg % 180 !== 0;
  const c = document.createElement('canvas');
  c.width = swap ? h : w; c.height = swap ? w : h;
  const x = c.getContext('2d');
  x.translate(c.width / 2, c.height / 2); x.rotate(deg * Math.PI / 180); x.drawImage(src, -w / 2, -h / 2);
  return c;
}
/* st: { mode: 'color' | 'doc', brightness: -50..50, contrast: -50..50 } */
function adjustCanvas(c, st) {
  if (st.mode !== 'doc' && !st.brightness && !st.contrast) return;
  const x = c.getContext('2d'), img = x.getImageData(0, 0, c.width, c.height), d = img.data, n = d.length;
  const k = clamp(st.contrast * 2, -100, 100), cf = (259 * (k + 255)) / (255 * (259 - k)), br = st.brightness * 2;
  const doc = st.mode === 'doc';
  let lo = 0, scale = 1;
  if (doc) {
    /* stretch the levels so the paper turns white and the print turns dark */
    const hist = new Uint32Array(256); let cnt = 0;
    for (let i = 0; i < n; i += 16) { hist[(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0]++; cnt++; }
    const pct = p => { let a = 0; for (let v = 0; v < 256; v++) { a += hist[v]; if (a >= cnt * p) return v; } return 255; };
    lo = pct(0.01); const hi = Math.max(lo + 40, pct(0.6)); scale = 255 / (hi - lo);
  }
  for (let i = 0; i < n; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (doc) { const v = ((0.299 * r + 0.587 * g + 0.114 * b) - lo) * scale; r = g = b = v; }
    d[i] = (r - 128) * cf + 128 + br; d[i + 1] = (g - 128) * cf + 128 + br; d[i + 2] = (b - 128) * cf + 128 + br;
  }
  x.putImageData(img, 0, 0);
}

/* The editor resolves with a JPEG blob, or null when the student cancels. */
function editPhoto(srcCanvas) {
  return new Promise(resolve => {
    let d = $('#editor');
    if (!d) { d = document.createElement('dialog'); d.id = 'editor'; d.className = 'editor'; document.body.appendChild(d); }
    const st = { rot: 0, mode: 'color', brightness: 0, contrast: 0, crop: { x: 0, y: 0, w: 1, h: 1 } };
    const prevBase = scaleCanvas(srcCanvas, 900);
    d.innerHTML = `
      <div class="ed-head">${esc(t('ed.title'))}</div>
      <div class="ed-body">
        <div class="ed-stage"><div class="ed-wrap"><canvas id="edc"></canvas>
          <div class="crop" id="crop"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div></div>
        <div class="note">${esc(t('ed.hint'))}</div>
        <div class="row">
          <button type="button" class="btn small sec" id="rl">⟲ ${esc(t('ed.left'))}</button>
          <button type="button" class="btn small sec" id="rr">⟳ ${esc(t('ed.right'))}</button>
          <button type="button" class="btn small ghost" id="rc">${esc(t('ed.reset'))}</button>
        </div>
        <div class="seg" id="modes"><button type="button" class="on" data-m="color">${esc(t('ed.original'))}</button><button type="button" data-m="doc">${esc(t('ed.doc'))}</button></div>
        <label for="edb">${esc(t('ed.bright'))}<input id="edb" type="range" min="-50" max="50" value="0"></label>
        <label for="edk">${esc(t('ed.contrast'))}<input id="edk" type="range" min="-50" max="50" value="0"></label>
      </div>
      <div class="ed-actions"><button type="button" class="btn ghost" id="edx">${esc(t('ed.cancel'))}</button><button type="button" class="btn" id="edu">${esc(t('ed.use'))}</button></div>`;
    const cv = $('#edc', d), box = $('#crop', d), wrap = $('.ed-wrap', d);
    let done = false, raf = 0;
    const finish = v => { if (done) return; done = true; if (d.open) d.close(); resolve(v); };

    const draw = () => {
      const r = rotateCanvas(prevBase, st.rot); adjustCanvas(r, st);
      cv.width = r.width; cv.height = r.height; cv.getContext('2d').drawImage(r, 0, 0);
    };
    const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
    const paintCrop = () => {
      const c = st.crop;
      box.style.left = c.x * 100 + '%'; box.style.top = c.y * 100 + '%'; box.style.width = c.w * 100 + '%'; box.style.height = c.h * 100 + '%';
    };
    const rotate = by => { st.rot = (st.rot + by) % 360; st.crop = { x: 0, y: 0, w: 1, h: 1 }; draw(); paintCrop(); };
    $('#rl', d).onclick = () => rotate(270);
    $('#rr', d).onclick = () => rotate(90);
    $('#rc', d).onclick = () => { st.crop = { x: 0, y: 0, w: 1, h: 1 }; paintCrop(); };
    d.querySelectorAll('#modes button').forEach(b => b.onclick = () => {
      st.mode = b.dataset.m;
      d.querySelectorAll('#modes button').forEach(x => x.classList.toggle('on', x === b)); redraw();
    });
    $('#edb', d).oninput = e => { st.brightness = +e.target.value; redraw(); };
    $('#edk', d).oninput = e => { st.contrast = +e.target.value; redraw(); };

    let drag = null;
    box.addEventListener('pointerdown', e => {
      drag = { h: (e.target.dataset && e.target.dataset.h) || 'move', sx: e.clientX, sy: e.clientY, rect: wrap.getBoundingClientRect(), o: { ...st.crop } };
      try { box.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    });
    box.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = (e.clientX - drag.sx) / drag.rect.width, dy = (e.clientY - drag.sy) / drag.rect.height, o = drag.o, MIN = 0.08;
      if (drag.h === 'move') {
        st.crop = { x: clamp(o.x + dx, 0, 1 - o.w), y: clamp(o.y + dy, 0, 1 - o.h), w: o.w, h: o.h };
      } else {
        let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
        if (drag.h.includes('w')) x1 = clamp(o.x + dx, 0, x2 - MIN);
        if (drag.h.includes('e')) x2 = clamp(o.x + o.w + dx, x1 + MIN, 1);
        if (drag.h.includes('n')) y1 = clamp(o.y + dy, 0, y2 - MIN);
        if (drag.h.includes('s')) y2 = clamp(o.y + o.h + dy, y1 + MIN, 1);
        st.crop = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      }
      paintCrop();
    });
    const stop = () => { drag = null; };
    box.addEventListener('pointerup', stop); box.addEventListener('pointercancel', stop);

    const exportBlob = () => {
      const r = rotateCanvas(srcCanvas, st.rot), c = st.crop;
      const sx = Math.round(c.x * r.width), sy = Math.round(c.y * r.height);
      const sw = Math.max(1, Math.min(r.width - sx, Math.round(c.w * r.width))), sh = Math.max(1, Math.min(r.height - sy, Math.round(c.h * r.height)));
      const k = Math.min(1, 1600 / Math.max(sw, sh)), out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(sw * k)); out.height = Math.max(1, Math.round(sh * k));
      out.getContext('2d').drawImage(r, sx, sy, sw, sh, 0, 0, out.width, out.height);
      adjustCanvas(out, st);
      return new Promise((res, rej) => out.toBlob(b => (b ? res(b) : rej(new Error(t('err.process')))), 'image/jpeg', 0.85));
    };
    $('#edu', d).onclick = async () => { try { finish(await exportBlob()); } catch { finish(null); } };
    $('#edx', d).onclick = () => finish(null);
    d.onclose = () => finish(null);
    d.showModal();
    draw(); paintCrop();
  });
}

/* ---------- reading a receipt photo (OCR) ---------- */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
function isoDate(y, m, d) {
  if (y < 100) y += 2000;
  if (y < 2000 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  if (dt.getTime() > Date.now() + 864e5) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function parseReceiptText(raw) {
  const text = String(raw || '').replace(/\r/g, '');
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const out = { amount: null, date: null, receiptNo: null, category: null };

  /* amount: prefer the line that says total or amount paid, never the cash given or the change */
  const cands = [];
  for (const line of lines) {
    const nums = line.match(/\d{1,3}(?:,\d{3})+\.\d{2}(?!\d)|\d+\.\d{2}(?!\d)/g) || [];
    if (!nums.length) continue;
    let score = 1;
    if (/sub\s*-?\s*total/i.test(line)) score = 1;
    else if (/total|grand|amount\s*(due|paid)?|paid|payment/i.test(line)) score = 3;
    if (/\b(cash|tender|change|vat|tax)\b/i.test(line) && score < 3) score = 0;
    nums.forEach(n => cands.push({ v: parseFloat(n.replace(/,/g, '')), score }));
  }
  if (cands.length) {
    const best = Math.max(...cands.map(c => c.score));
    out.amount = Math.max(...cands.filter(c => c.score === best).map(c => c.v));
  } else {
    for (const line of lines) {
      const m = line.match(/(?:total|amount|paid|payment)[^\d\n]{0,18}(\d{1,3}(?:,\d{3})+|\d+)(?![\d.\/-])/i);
      if (m) { out.amount = parseFloat(m[1].replace(/,/g, '')); break; }
    }
  }
  if (!(out.amount > 0)) out.amount = null;

  /* date: year first, then month/day/year (usual in the Philippines), then month names */
  const tryDates = [
    [/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/g, m => isoDate(+m[1], +m[2], +m[3])],
    [/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/g, m => {
      const a = +m[1], b = +m[2], y = +m[3];
      if (a > 12) return isoDate(y, b, a);
      return isoDate(y, a, b);
    }],
    [/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi, m => isoDate(+m[3], MONTHS[m[1].toLowerCase()], +m[2])],
    [/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/gi, m => isoDate(+m[3], MONTHS[m[2].toLowerCase()], +m[1])]
  ];
  outer: for (const [re, fn] of tryDates) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(text))) { const iso = fn(m); if (iso) { out.date = iso; break outer; } }
  }

  /* receipt number */
  const noRe = /(?:\bo\.?\s?r\.?\s*(?:no\.?|number|#)|official\s+receipt\s*(?:no\.?|number|#)?|receipt\s*(?:no\.?|number|#)|invoice\s*(?:no\.?|number|#)|ref(?:erence)?\s*(?:no\.?|number|#)|control\s*(?:no\.?|number|#)|\bo\.?r\.?(?=\s+[A-Z0-9-]*\d)|\bno\.|#)\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9\-\/]{2,19})/gi;
  let nm;
  while ((nm = noRe.exec(text))) {
    const v = nm[1].replace(/[-\/]+$/, '');
    if (/\d/.test(v) && v.length >= 3 && !/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(v)) { out.receiptNo = v; break; }
  }

  /* category from keywords */
  const low = text.toLowerCase();
  const catRules = [
    [/tuition|matric/, 'Tuition'], [/laborator|lab fee|\blab\b/, 'Laboratory Fee'], [/exam|quiz|test fee/, 'Exam Fee'],
    [/uniform|book|module|\bp\.?e\.?\b/, 'Books & Uniform'], [/organi[sz]ation|\borg\b|club|society|association|council/, 'Organization Fee'],
    [/sports?\s?fest|fest|intramural|activity|foundation|acquaintance|event/, 'School Activity']
  ];
  for (const [re, c] of catRules) if (re.test(low)) { out.category = c; break; }
  return out;
}
let tessPromise = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (tessPromise) return tessPromise;
  tessPromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = () => res(); s.onerror = () => { tessPromise = null; rej(new Error('offline')); };
    document.head.appendChild(s);
  });
  return tessPromise;
}
if (window.__RS_TEST) window.__rs = { parseReceiptText, adjustCanvas, rotateCanvas, DICT };

/* ---------- Supabase ---------- */
let sb, session = null, offlineUser = null, profile = null, recovery = false;
const curUser = () => (session && session.user) || offlineUser;
const urlCache = new Map();

async function loadConfig() {
  try {
    const r = await fetch('/api/config', { cache: 'no-store' });
    if (!r.ok) throw new Error('config');
    const c = await r.json(); lsSet('rs-cfg', JSON.stringify(c)); return c;
  } catch (e) {
    const c = lsJSON('rs-cfg'); if (c && c.url) return c; throw e;
  }
}
async function boot() {
  applyTheme(); applyStatic();
  let cfg;
  try { cfg = await loadConfig(); if (!window.supabase) throw new Error('lib'); }
  catch { view.innerHTML = `<div class="card empty">${esc(t('net.cantReach'))}</div>`; return; }
  sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  try { const { data } = await sb.auth.getSession(); session = data.session; } catch { session = null; }
  if (session) lsSet('rs-last-user', JSON.stringify({ id: session.user.id, email: session.user.email }));
  else if (!navigator.onLine) { const u = lsJSON('rs-last-user'); if (u && u.id) offlineUser = u; }
  sb.auth.onAuthStateChange((event, s) => {
    const was = curUser() && curUser().id;
    session = s;
    if (s) { offlineUser = null; lsSet('rs-last-user', JSON.stringify({ id: s.user.id, email: s.user.email })); }
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    if (event === 'SIGNED_OUT') { profile = null; urlCache.clear(); offlineUser = null; lsDel('rs-last-user'); }
    const now = curUser() && curUser().id;
    if (was !== now || event === 'PASSWORD_RECOVERY') { profile = null; setTimeout(() => { render(); syncQueue(); }, 0); }
  });
  render(); syncQueue();
}

async function loadProfile() {
  const u = curUser();
  try {
    const { data, error } = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
    if (error) throw error;
    profile = data || { id: u.id, full_name: '' };
    lsSet('rs-profile-' + u.id, JSON.stringify(profile));
  } catch (e) {
    const c = lsJSON('rs-profile-' + u.id);
    if (c && isNetErr(e)) profile = c; else throw e;
  }
}
async function signed(paths) {
  if (!navigator.onLine) return;
  const need = [...new Set(paths.filter(p => p && !urlCache.has(p)))];
  if (!need.length) return;
  try {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(need, 3600);
    if (!error && data) data.forEach(d => { if (d.signedUrl) urlCache.set(d.path, d.signedUrl); });
  } catch { /* thumbnails are optional */ }
}

/* ---------- saved-offline queue ---------- */
let obp;
const obdb = () => obp ||= new Promise((res, rej) => {
  const r = indexedDB.open('receiptsafe-outbox', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('q', { keyPath: 'qid' });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const obx = async (mode, fn) => {
  const d = await obdb();
  return new Promise((res, rej) => {
    const tx = d.transaction('q', mode), rq = fn(tx.objectStore('q'));
    tx.oncomplete = () => res(rq && 'result' in rq ? rq.result : undefined);
    tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  });
};
const ob = { all: () => obx('readonly', s => s.getAll()), get: id => obx('readonly', s => s.get(id)), put: i => obx('readwrite', s => s.put(i)), del: id => obx('readwrite', s => s.delete(id)) };
async function queuedItems() {
  const u = curUser(); if (!u) return [];
  try { return (await ob.all()).filter(i => i.userId === u.id).sort((a, b) => b.createdAt - a.createdAt); } catch { return []; }
}
const toPseudo = it => ({ ...it.row, id: it.qid, status: 'queued', _queued: true, _blob: it.blob, image_path: null, created_at: new Date(it.createdAt).toISOString(), profiles: null });

let syncing = false, syncTimer = 0;
async function syncQueue(manual = false) {
  if (syncing || !sb || !curUser() || !session) return;
  const items = await queuedItems();
  if (!items.length) return;
  if (!navigator.onLine && !manual) return;
  syncing = true; let ok = 0, stuck = 0, lastErr = '';
  try {
    for (const it of items.slice().reverse()) {
      try {
        let path = it.imagePath;
        if (!path && it.blob) {
          path = `${it.userId}/${it.qid}.jpg`;
          const up = await sb.storage.from(BUCKET).upload(path, it.blob, { contentType: 'image/jpeg', upsert: false });
          if (up.error && !(String(up.error.statusCode) === '409' || /already exists|duplicate/i.test(up.error.message || ''))) throw up.error;
          it.imagePath = path; await ob.put(it);
        }
        const { error } = await sb.from('receipts').insert({ ...it.row, id: it.qid, user_id: it.userId, image_path: path || null });
        if (error && error.code !== '23505') throw error;
        await ob.del(it.qid); ok++;
      } catch (e) {
        if (isNetErr(e)) { stuck++; break; }
        stuck++; lastErr = errText(e);
      }
    }
  } finally { syncing = false; }
  if (ok) { toast(tn('net.uploaded', ok)); if (/^#\/(receipts)?$|^$/.test(location.hash)) render(); }
  if (stuck && manual) toast(lastErr ? t('net.queueFail', { m: lastErr }) : t('net.stillWaiting'));
  clearTimeout(syncTimer);
  if (stuck) syncTimer = setTimeout(() => syncQueue(), 60000);
}
function updateNet() {
  const bar = $('#netbar'); if (!bar) return;
  bar.hidden = navigator.onLine; bar.textContent = t('net.offline');
}
window.addEventListener('offline', updateNet);
window.addEventListener('online', () => setTimeout(() => { synced = null; syncOnce(); }, 2500));
window.addEventListener('online', async () => {
  updateNet();
  if (!session && offlineUser && sb) {
    try { const { data } = await sb.auth.getSession(); if (data.session) { session = data.session; offlineUser = null; profile = null; render(); } } catch { /* try again later */ }
  }
  syncQueue();
});

/* ---------- shell and router ---------- */
const ICONS = {
  home: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
  list: 'M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-3.3 0-9 1.7-9 5v2h18v-2c0-3.3-5.7-5-9-5Z',
  calc: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 3v3h10V6H7Zm0 5v2h2v-2H7Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2ZM7 15v2h2v-2H7Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z'
};
const tabIcon = p => `<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="${p}"/></svg>`;
function shell(path) {
  const tabs = [['#/', t('tab.dashboard'), ICONS.home, ''], ['#/receipts', t('tab.receipts'), ICONS.list, 'receipts'], ['#/fees', t('tab.fees'), ICONS.calc, 'fees'], ['#/account', t('tab.account'), ICONS.user, 'account']];
  const bar = $('#tabbar'); bar.hidden = false;
  bar.innerHTML = tabs.map(([h, l, i]) => `<button class="tab" data-route="${h}">${tabIcon(i)}${esc(l)}</button>`).join('');
  bar.querySelectorAll('.tab').forEach(b => {
    const key = tabs.find(x => x[0] === b.dataset.route)[3];
    const on = key === path || ((path === 'receipt' || path === 'queued') && key === 'receipts') || (path === 'edit' && key === 'receipts');
    b.classList.toggle('on', on);
    b.onclick = () => { location.hash = b.dataset.route; };
  });
  $('#fab').hidden = ['add', 'edit', 'account', 'queued', 'fees'].includes(path);
  const chip = $('#chip'); chip.hidden = false; if (bellEl()) bellEl().hidden = false;
  const u = curUser();
  chip.innerHTML = `<b>${esc(profile.full_name || (u && u.email) || '')}</b>${esc((u && u.email) || '')}`;
}
function bareShell() { if (bellEl()) bellEl().hidden = true; $('#tabbar').hidden = true; $('#fab').hidden = true; $('#chip').hidden = true; }
$('#fab').addEventListener('click', () => { location.hash = '#/add'; });

const student = {};
async function render() {
  freeUrls();
  if (!sb) return;
  try {
    if (recovery) return recoveryView();
    if (!curUser()) { bareShell(); return authView(); }
    if (!profile) await loadProfile();
    await syncOnce();
    const [, path, arg] = (location.hash || '').split('?')[0].match(/^#\/([^/]*)\/?(.*)$/) || [, '', ''];
    shell(path);
    const fn = student[path] || student[''];
    view.innerHTML = `<div class="spin">${esc(t('loading'))}</div>`;
    await fn(decodeURIComponent(arg));
    view.scrollTop = 0; refreshBell();
  } catch (e) {
    console.error(e);
    const msg = isNetErr(e) ? t('net.needNet') : t('wrong', { m: errText(e) });
    view.innerHTML = `<div class="card">${esc(msg)}<div class="row" style="margin-top:12px"><button class="btn small" id="retry">${esc(t('retry'))}</button></div></div>`;
    $('#retry').onclick = render;
  }
}
window.addEventListener('hashchange', render);

/* ---------- auth ---------- */
function authView(mode = 'login') {
  view.innerHTML = `
  <div class="auth">
    <div class="seg" role="tablist">
      <button class="${mode === 'login' ? 'on' : ''}" data-m="login">${esc(t('auth.login'))}</button>
      <button class="${mode === 'register' ? 'on' : ''}" data-m="register">${esc(t('auth.register'))}</button>
    </div>
    <form id="af" class="card" novalidate>
      ${mode === 'register' ? `
        <label for="fn">${esc(t('auth.fullName'))}</label><input id="fn" autocomplete="name" required maxlength="80">` : ''}
      <label for="em">${esc(t('auth.email'))}</label><input id="em" type="email" autocomplete="email" required>
      <label for="pw">${esc(t('auth.password'))}</label>${pwField('pw', mode === 'login' ? 'current-password' : 'new-password')}
      ${mode === 'register' ? `<div class="note">${esc(t('auth.pwHint'))}</div>` : ''}
      <div id="err" class="err" role="alert">${navigator.onLine ? '' : esc(t('auth.offline'))}</div>
      <div class="row" style="margin-top:14px"><button class="btn" type="submit" id="go" style="flex:1">${esc(mode === 'login' ? t('auth.login') : t('auth.create'))}</button></div>
      ${mode === 'login' ? `<p style="margin:12px 0 0"><button type="button" class="linkbtn" id="forgot">${esc(t('auth.forgot'))}</button></p>` : ''}
    </form>
    <p class="note" style="text-align:center">${esc(t('auth.privacy'))}</p>
  </div>`;
  view.querySelectorAll('.seg button').forEach(b => b.onclick = () => authView(b.dataset.m));
  bindPw();
  const err = m => { $('#err').textContent = m; };
  const busy = v => { $('#go').disabled = v; };
  if (mode === 'login') $('#forgot').onclick = async () => {
    const email = $('#em').value.trim();
    if (!email) return err(t('auth.needEmail'));
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
    err(''); toast(error ? errText(error) : t('auth.resetSent'));
  };
  $('#af').addEventListener('submit', async e => {
    e.preventDefault(); err('');
    const email = $('#em').value.trim(), password = $('#pw').value;
    if (!email || !password) return err(t('auth.enterBoth'));
    busy(true);
    try {
      if (mode === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(isNetErr(error) ? t('auth.offline') : /confirm/i.test(error.message) ? t('auth.confirm') : t('auth.wrong'));
      } else {
        const full_name = $('#fn').value.trim();
        if (!full_name) throw new Error(t('auth.needNameId'));
        if (password.length < 8) throw new Error(t('auth.pwShort'));
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: location.origin + '/' } });
        if (error) throw new Error(error.message);
        if (!data.session) { authView('login'); toast(t('auth.created')); return; }
      }
    } catch (x) { err(errText(x)); busy(false); }
  });
}
function recoveryView() {
  bareShell();
  view.innerHTML = `<div class="auth"><form id="rf" class="card" novalidate>
    <h2 style="margin-top:0">${esc(t('auth.newPwTitle'))}</h2>
    <label for="np">${esc(t('auth.newPw'))}</label>${pwField('np', 'new-password')}
    <div id="err" class="err" role="alert"></div>
    <div class="row" style="margin-top:14px"><button class="btn" type="submit">${esc(t('auth.savePw'))}</button></div></form></div>`;
  bindPw();
  $('#rf').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('#np').value;
    if (pw.length < 8) return ($('#err').textContent = t('auth.pwShort'));
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return ($('#err').textContent = errText(error));
    recovery = false; toast(t('auth.pwUpdated')); render();
  });
}

/* ---------- shared pieces ---------- */
const pill = r => (r._queued ? `<span class="pill queued">${esc(t('status.queued'))}</span>` : '');
const photoSrc = r => (r._blob ? localUrl(r._blob) : r.image_path ? urlCache.get(r.image_path) : null);
function itemHTML(r, who) {
  const src = photoSrc(r);
  const thumb = src ? `<img class="thumb" alt="" src="${esc(src)}">` : `<div class="thumb">${esc(t('rec.noPhotoShort'))}</div>`;
  return `<button class="item" data-id="${esc(r.id)}" data-q="${r._queued ? 1 : 0}">${thumb}
    <div class="mid"><div class="t">${esc(r.description)}</div>
    <div class="s">${who ? esc(who) + ' · ' : ''}${fmtDate(r.paid_on)} · ${esc(catName(r.category))}</div>
    <div class="s">${pill(r)}${r.receipt_no ? 'No. ' + esc(r.receipt_no) : ''}</div></div>
    <div class="amt">${peso(r.amount)}</div></button>`;
}
function bindItems(root = view) {
  root.querySelectorAll('.item').forEach(b => b.onclick = () => { location.hash = (b.dataset.q === '1' ? '#/queued/' : '#/receipt/') + b.dataset.id; });
}
const byDateDesc = (a, b) => String(b.paid_on).localeCompare(String(a.paid_on)) || String(b.created_at).localeCompare(String(a.created_at));

let showingCache = false;
async function myReceipts() {
  let remote; showingCache = false;
  const u = curUser();
  try {
    const { data, error } = await sb.from('receipts').select('*').order('paid_on', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    remote = data; lsSet('rs-cache-' + u.id, JSON.stringify(data));
    await signed(data.map(r => r.image_path));
  } catch (e) {
    if (!isNetErr(e)) throw e;
    remote = lsJSON('rs-cache-' + u.id) || []; showingCache = true;
  }
  const q = (await queuedItems()).map(toPseudo);
  return [...q, ...remote].sort(byDateDesc);
}
function queueBanner(n) {
  return n ? `<div class="banner info" id="qb">${esc(tn('net.waiting', n))} <button type="button" class="linkbtn" id="qnow">${esc(t('net.uploadNow'))}</button></div>` : '';
}
function bindQueueBanner() {
  const b = $('#qnow');
  if (b) b.onclick = async () => { b.disabled = true; b.textContent = t('net.uploading'); await syncQueue(true); render(); };
}

/* ---------- charts ---------- */
const monthKey = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1);
function monthlyTotals(list, n) {
  const out = [], now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: d.toLocaleDateString(loc(), { month: 'short' }), year: d.getFullYear(), value: 0 });
  }
  const idx = Object.fromEntries(out.map((m, i) => [m.key, i]));
  list.forEach(r => { const k = String(r.paid_on).slice(0, 7); if (k in idx) out[idx[k]].value += Number(r.amount); });
  return out;
}
function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
const compact = n => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 || n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(Math.round(n)));
function chartHTML(list, n) {
  const data = monthlyTotals(list, n);
  if (!data.reduce((s, m) => s + m.value, 0)) return `<p class="note">${esc(t('chart.empty'))}</p>`;
  const W = 360, H = 190, L = 40, R = 8, T = 16, B = 26, pw = W - L - R, ph = H - T - B;
  const max = niceMax(Math.max(...data.map(m => m.value))), bw = pw / n, bar = bw * 0.62;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('chart.byMonth'))}">`;
  [0, 0.5, 1].forEach(f => {
    const y = T + ph * (1 - f);
    s += `<line class="ch-grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="ch-txt" x="${L - 5}" y="${y + 3}" text-anchor="end">₱${compact(max * f)}</text>`;
  });
  data.forEach((m, i) => {
    const x = L + i * bw + (bw - bar) / 2, h = ph * (m.value / max), y = T + ph - h, cx = x + bar / 2;
    s += `<rect class="ch-bar${i === n - 1 ? ' now' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bar.toFixed(1)}" height="${Math.max(h, m.value > 0 ? 1 : 0).toFixed(1)}" rx="3"><title>${esc(m.label + ' ' + m.year + ': ' + peso(m.value))}</title></rect>`;
    if (n <= 6 && m.value > 0) s += `<text class="ch-val" x="${cx.toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle">${compact(m.value)}</text>`;
    s += `<text class="ch-txt" x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(m.label)}</text>`;
  });
  return s + '</svg>';
}
function catHTML(list) {
  const by = {}; list.forEach(r => { by[r.category] = (by[r.category] || 0) + Number(r.amount); });
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return `<p class="note">${esc(t('chart.empty'))}</p>`;
  const total = rows.reduce((s, r) => s + r[1], 0), max = rows[0][1];
  return rows.map(([k, v]) => `<div class="cat"><div class="cat-top"><span>${esc(catName(k))}</span><b>${peso(v)}</b></div>
    <div class="cat-bar"><div class="cat-track"><div class="cat-fill" style="width:${(v / max * 100).toFixed(1)}%"></div></div><span class="cat-pct">${Math.round(v / total * 100)}%</span></div></div>`).join('');
}
let chartRange = 6;

/* ---------- budget, export, share ---------- */
const goalKey = () => 'rs-goal-' + curUser().id;
function goalCard(month, prev) {
  const goal = Number(lsGet(goalKey())) || 0;
  const diff = prev > 0 ? Math.round((month - prev) / prev * 100) : null;
  const trend = diff === null || diff === 0 ? '' : `<span class="trend ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}% ${esc(t('goal.vsLast'))}</span>`;
  const over = goal && month > goal, pct = goal ? Math.min(100, month / goal * 100) : 0;
  return `<div class="card slip"><div class="chart-head"><b>${esc(t('goal.title'))}</b>
    <button type="button" class="btn small sec" id="goalEdit">${esc(goal ? t('goal.edit') : t('goal.set'))}</button></div>
    ${goal ? `<div class="slip-amt"><b>${peso(month)}</b><span>/ ${peso(goal)}</span></div>
      <div class="cat-track slip-track"><div class="cat-fill${over ? ' over' : ''}" style="width:${pct.toFixed(1)}%"></div></div>
      <div class="note">${esc(over ? t('goal.over', { a: peso(month - goal) }) : t('goal.left', { a: peso(goal - month) }))} ${trend}</div>`
      : `<p class="note" style="margin:0">${esc(t('goal.hint'))} ${trend}</p>`}</div>`;
}
function askNumber(msg, cur) {
  return new Promise(res => {
    const d = $('#dlg');
    d.innerHTML = `<p style="margin:0 0 10px">${esc(msg)}</p><input id="gdn" type="number" inputmode="decimal" min="0" step="1" value="${esc(cur || '')}">
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" id="gno">${esc(t('cancel'))}</button><button class="btn" id="gyes">${esc(t('goal.save'))}</button></div>`;
    let done = false;
    const fin = v => { if (done) return; done = true; if (d.open) d.close(); res(v); };
    $('#gyes').onclick = () => fin(Math.max(0, parseFloat($('#gdn').value) || 0)); $('#gno').onclick = () => fin(null); d.onclose = () => fin(null);
    d.showModal(); $('#gdn').focus();
  });
}
function exportCSV(list) {
  const cell = v => { let x = String(v ?? ''); if (/^[=+\-@]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; };
  const rows = [['Date paid', 'Description', 'Category', 'Amount (PHP)', 'Receipt no.', 'Notes']]
    .concat(list.map(r => [r.paid_on, r.description, r.category, Number(r.amount).toFixed(2), r.receipt_no, r.notes]));
  const blob = new Blob(['\ufeff' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `receipts-${todayISO()}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function shareReceipt(r) {
  const b = await (await fetch(urlCache.get(r.image_path))).blob();
  const file = new File([b], 'receipt.jpg', { type: 'image/jpeg' });
  const data = { title: r.description, text: `${r.description} · ${peso(r.amount)} · ${fmtDate(r.paid_on)}` };
  if (navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
  await navigator.share(data);
}

/* ---------- cloud sync (fees, budget, school balance, fee links) and push ---------- */
/* localStorage stays as the fast, offline copy. Supabase is the shared copy the server reads for push alerts. */
let synced = null, syncChain = Promise.resolve(), pend = 0;
const dirtyKey = () => 'rs-dirty-' + curUser().id;
async function pushAll() {
  const u = session && session.user; if (!u) throw new Error('offline');
  const fees = lsJSON(feesKey()) || [], sch = lsJSON(schoolKey()), links = lsJSON(linkKey()) || {};
  let r = await sb.from('user_prefs').upsert({ user_id: u.id, monthly_budget: Number(lsGet(goalKey())) || 0, school_balance: sch ? sch.amount : null, school_balance_asof: sch ? sch.asOf : null, lang, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (r.error) throw r.error;
  if (fees.length) {
    r = await sb.from('fees').upsert(fees.map((f, i) => ({ id: f.id, user_id: u.id, name: f.name, amount: f.amount, category: f.category, term: f.term || '', tag: f.tag || '', due_on: f.due || null, official: !!f.official, position: i })), { onConflict: 'id' });
    if (r.error) throw r.error;
  }
  const have = await sb.from('fees').select('id').eq('user_id', u.id); if (have.error) throw have.error;
  const keep = new Set(fees.map(f => f.id)), gone = have.data.map(x => x.id).filter(id => !keep.has(id));
  if (gone.length) { r = await sb.from('fees').delete().in('id', gone); if (r.error) throw r.error; }
  const rows = Object.entries(links).filter(([, fid]) => keep.has(fid)).map(([rid, fid]) => ({ receipt_id: rid, user_id: u.id, fee_id: fid }));
  if (rows.length) { r = await sb.from('fee_links').upsert(rows, { onConflict: 'receipt_id' }); if (r.error) throw r.error; }
  const hl = await sb.from('fee_links').select('receipt_id').eq('user_id', u.id); if (hl.error) throw hl.error;
  const lk = new Set(rows.map(x => x.receipt_id)), dead = hl.data.map(x => x.receipt_id).filter(id => !lk.has(id));
  if (dead.length) { r = await sb.from('fee_links').delete().in('receipt_id', dead); if (r.error) throw r.error; }
}
function cloudSave() {
  const u = curUser(); if (!u) return;
  lsSet(dirtyKey(), '1');
  if (!session || !navigator.onLine) return; /* stays marked; uploaded on the next sync */
  pend++;
  syncChain = syncChain.then(pushAll).then(() => { if (pend === 1) lsDel(dirtyKey()); })
    .catch(e => console.warn('cloud save', e)).finally(() => { pend--; });
}
async function syncOnce() {
  const u = curUser(); if (!u || !session || synced === u.id) return;
  synced = u.id; await syncUserData();
}
async function syncUserData() {
  const u = session && session.user; if (!u || !sb || !navigator.onLine) { synced = null; return; }
  const sk = 'rs-synced-' + u.id;
  try {
    const [pf, fe, fl] = await Promise.all([
      sb.from('user_prefs').select('*').eq('user_id', u.id).maybeSingle(),
      sb.from('fees').select('*').eq('user_id', u.id).order('position'),
      sb.from('fee_links').select('receipt_id,fee_id').eq('user_id', u.id)
    ]);
    for (const x of [pf, fe, fl]) if (x.error) throw x.error;
    const dirty = lsGet(dirtyKey()) === '1', empty = !pf.data && !fe.data.length;
    const hasLocal = (lsJSON(feesKey()) || []).length || lsGet(goalKey()) || lsGet(schoolKey());
    if ((dirty && (lsGet(sk) === '1' || empty)) || (empty && hasLocal)) {
      await pushAll(); lsDel(dirtyKey()); /* first run moves this phone's data to the cloud */
    } else {
      lsSet(feesKey(), JSON.stringify(fe.data.map(r => ({ id: r.id, name: r.name, amount: Number(r.amount), category: r.category, term: r.term || '', tag: r.tag || '', due: r.due_on || '', official: !!r.official }))));
      lsSet(linkKey(), JSON.stringify(Object.fromEntries(fl.data.map(x => [x.receipt_id, x.fee_id]))));
      const p = pf.data;
      if (p) {
        if (Number(p.monthly_budget) > 0) lsSet(goalKey(), String(Number(p.monthly_budget))); else lsDel(goalKey());
        if (p.school_balance != null) lsSet(schoolKey(), JSON.stringify({ amount: Number(p.school_balance), asOf: p.school_balance_asof || todayISO() })); else lsDel(schoolKey());
      }
    }
    lsSet(sk, '1');
  } catch (e) { synced = null; console.warn('sync', e); }
}

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const keyBytes = s => { const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function enablePush() {
  const cfg = lsJSON('rs-cfg') || {}; if (!cfg.vapidPublicKey) throw new Error('Push is not set up on the server yet.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.vapidPublicKey) });
  const j = sub.toJSON(), uid_ = session.user.id;
  let r = await sb.from('user_prefs').upsert({ user_id: uid_, lang }, { onConflict: 'user_id' }); if (r.error) throw r.error;
  r = await sb.from('push_subscriptions').upsert({ user_id: uid_, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' });
  if (r.error) { await sub.unsubscribe().catch(() => {}); throw r.error; }
  lsSet('rs-push', '1');
}
async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe().catch(() => {}); }
  } finally { lsSet('rs-push', '0'); }
}

/* ---------- notifications ---------- */
const bellEl = () => $('#btnBell');
async function getAlerts() {
  const u = curUser(); if (!u) return [];
  const rs = [...(await queuedItems()).map(toPseudo), ...(lsJSON('rs-cache-' + u.id) || [])], out = [], nQ = rs.filter(r => r._queued).length;
  if (nQ) out.push({ key: 'q', lvl: 'info', text: tn('net.waiting', nQ) });
  const goal = Number(lsGet(goalKey())) || 0;
  if (goal) {
    const mk = monthKey(new Date()), m = rs.filter(r => String(r.paid_on).startsWith(mk)).reduce((s, r) => s + Number(r.amount), 0);
    if (m > goal) out.push({ key: 'b' + mk + 'o', lvl: 'bad', text: t('goal.over', { a: peso(m - goal) }) });
    else if (m >= goal * 0.8) out.push({ key: 'b' + mk, lvl: 'warn', text: t('al.budget80', { p: Math.round(m / goal * 100), a: peso(goal - m) }) });
  }
  const fees = getFees();
  if (fees.length) {
    const T = feeTotals(fees, rs), today = new Date(todayISO() + 'T00:00:00');
    fees.filter(f => f.due).forEach(f => {
      const left = Math.max(0, f.amount - T.paid[f.id]); if (left < 0.005) return;
      const d = Math.round((new Date(f.due + 'T00:00:00') - today) / 864e5), a = peso(left);
      if (d < 0) out.push({ key: 'f' + f.id + 'o', lvl: 'bad', text: t('al.overdue', { n: f.name, d: -d, a }) });
      else if (d <= 7) out.push({ key: 'f' + f.id + d, lvl: 'warn', text: t(d ? 'al.due' : 'al.dueToday', { n: f.name, d, a }) });
    });
  }
  return out;
}
function notifyPhone(al) {
  try {
    if (lsGet('rs-push') === '1') return; /* the server sends these now */
    if (lsGet('rs-notify') !== '1' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const seen = lsJSON('rs-notified') || {}, today = todayISO(), nxt = {};
    al.forEach(a => { nxt[a.key] = seen[a.key] || ''; });
    const fresh = al.filter(a => a.lvl !== 'info' && seen[a.key] !== today);
    if (!fresh.length) return;
    fresh.forEach(a => { nxt[a.key] = today; }); lsSet('rs-notified', JSON.stringify(nxt));
    navigator.serviceWorker.ready.then(r => fresh.forEach(a => r.showNotification('ReceiptSafe', { body: a.text, icon: 'icons/icon-192.png', tag: a.key })));
  } catch { /* alerts are optional */ }
}
async function refreshBell() {
  const b = bellEl(); if (!b || !curUser()) return;
  const al = await getAlerts(); b.classList.toggle('has', al.length > 0); b.dataset.n = al.length; notifyPhone(al);
}
async function openAlerts() {
  const al = await getAlerts(), d = $('#dlg'), perm = 'Notification' in window ? Notification.permission : 'none';
  const cfg = lsJSON('rs-cfg') || {}, usePush = pushSupported() && !!cfg.vapidPublicKey && !!session;
  const on = perm === 'granted' && (usePush ? lsGet('rs-push') === '1' : lsGet('rs-notify') === '1');
  d.innerHTML = `<b>${esc(t('al.title'))}</b>
    <div class="alist">${al.length ? al.map(a => `<div class="al ${a.lvl}">${esc(a.text)}</div>`).join('') : `<p class="note">${esc(t('al.none'))}</p>`}</div>
    ${perm === 'none' ? '' : `<div class="lbl">${esc(t('al.phone'))}</div>${perm === 'denied' ? `<p class="note">${esc(t('al.phoneDenied'))}</p>` : `<button type="button" class="btn small sec" id="alPhone">${esc(t(on ? 'al.phoneOff' : 'al.phoneOn'))}</button>`}<p class="note">${esc(t(usePush ? 'al.pushNote' : 'al.phoneNote'))}</p>`}
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button type="button" class="btn" id="alDone">${esc(t('al.done'))}</button></div>`;
  d.onclose = null; $('#alDone').onclick = () => d.close();
  const p = $('#alPhone');
  if (p) p.onclick = async () => {
    p.disabled = true;
    try {
      if (on) { if (usePush) await disablePush(); else lsSet('rs-notify', '0'); }
      else {
        const r = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
        if (r === 'granted') {
          if (usePush) await enablePush(); else { lsSet('rs-notify', '1'); notifyPhone(al); }
          toast(t('al.phoneOnMsg'));
        }
      }
    } catch (e) { toast(t('al.pushFail', { m: errText(e) })); }
    d.close(); refreshBell();
  };
  d.showModal();
}
if (bellEl()) bellEl().addEventListener('click', openAlerts);

/* ---------- school fee calculator ---------- */
const feesKey = () => 'rs-fees-' + curUser().id, schoolKey = () => 'rs-schoolbal-' + curUser().id;
const linkKey = () => 'rs-feelink-' + curUser().id;
async function feeNote(cat) {
  try {
    const fees = getFees(), mine = fees.filter(f => f.category === cat); if (!mine.length) return '';
    const T = feeTotals(fees, await myReceipts()), left = mine.reduce((s, f) => s + Math.max(0, f.amount - T.paid[f.id]), 0);
    return ' · ' + t(left > 0 ? 'fee.afterLeft' : 'fee.afterDone', { c: catName(cat), a: peso(left) });
  } catch { return ''; }
}
const getFees = () => lsJSON(feesKey()) || [];
const saveFees = a => { lsSet(feesKey(), JSON.stringify(a)); cloudSave(); };
let feeBy = 'term';
/* Match receipts to fees by category, oldest payment first. Extra money lands on the last fee of that category. */
function feeTotals(fees, rs) {
  const paid = Object.fromEntries(fees.map(f => [f.id, 0])); let unassigned = 0;
  const links = lsJSON(linkKey()) || {}, free = [];
  rs.forEach(r => { const f = links[r.id] && fees.find(x => x.id === links[r.id]); if (f) paid[f.id] += Number(r.amount); else free.push(r); });
  free.sort((a, b) => String(a.paid_on).localeCompare(String(b.paid_on))).forEach(r => {
    let left = Number(r.amount); const c = fees.filter(f => f.category === r.category);
    for (const f of c) { const take = Math.min(left, Math.max(0, f.amount - paid[f.id])); paid[f.id] += take; left -= take; }
    if (left > 0.005) { if (c.length) paid[c[c.length - 1].id] += left; else unassigned += left; }
  });
  const exp = fees.reduce((s, f) => s + f.amount, 0), got = Object.values(paid).reduce((s, v) => s + v, 0);
  return { paid, unassigned, exp, got, bal: Math.max(0, exp - got), pct: exp ? Math.min(100, got / exp * 100) : 0 };
}
function feeBadge(fees) {
  const n = fees.filter(f => f.official).length;
  if (!fees.length) return '';
  return n === fees.length ? `<span class="pill ok">${esc(t('fee.official'))}</span>` : `<span class="pill unverified">${esc(t(n ? 'fee.mixed' : 'fee.est'))}</span>`;
}
function feeMini(rs) {
  const fees = getFees(); if (!fees.length) return '';
  const T = feeTotals(fees, rs);
  return `<a class="card feemini" href="#/fees"><div class="chart-head"><b>${esc(t('fee.mini'))}</b>${feeBadge(fees)}</div>
    <div class="slip-amt" style="margin:4px 0 8px"><b>${peso(T.bal)}</b><span>${Math.round(T.pct)}%</span></div>
    <div class="cat-track"><div class="cat-fill" style="width:${T.pct.toFixed(1)}%"></div></div></a>`;
}
function feeDialog(f) {
  return new Promise(res => {
    const d = $('#dlg'), x = f || { name: '', amount: '', category: CATEGORIES[0], term: '', tag: '', official: false };
    d.innerHTML = `<form id="ff" novalidate><b>${esc(t(f ? 'fee.edit' : 'fee.add'))}</b>
      <label for="fnm">${esc(t('fee.name'))}</label><input id="fnm" maxlength="80" placeholder="${esc(t('fee.namePh'))}" value="${esc(x.name)}">
      <label for="fam">${esc(t('form.amount'))}</label><input id="fam" type="number" inputmode="decimal" min="0.01" step="0.01" value="${esc(x.amount)}">
      <label for="fct">${esc(t('form.cat'))}</label><select id="fct">${CATEGORIES.map(c => `<option value="${esc(c)}" ${c === x.category ? 'selected' : ''}>${esc(catName(c))}</option>`).join('')}</select>
      <label for="ftm">${esc(t('fee.term'))}</label><input id="ftm" maxlength="40" placeholder="${esc(t('fee.termPh'))}" value="${esc(x.term)}">
      <label for="ftg">${esc(t('fee.tag'))}</label><input id="ftg" maxlength="60" placeholder="${esc(t('fee.tagPh'))}" value="${esc(x.tag)}">
      <label for="fdu">${esc(t('fee.dueLabel'))}</label><input id="fdu" type="date" value="${esc(x.due || '')}">
      <label style="display:flex;gap:8px;align-items:center;font-weight:600"><input id="fof" type="checkbox" ${x.official ? 'checked' : ''}> ${esc(t('fee.official'))}</label>
      <div class="note">${esc(t('fee.officialHint'))}</div><div id="ferr" class="err" role="alert"></div>
      <div class="row" style="justify-content:flex-end;margin-top:14px">${f ? `<button type="button" class="btn danger" id="fdel" style="margin-right:auto">${esc(t('rec.delete'))}</button>` : ''}
        <button type="button" class="btn ghost" id="fno">${esc(t('cancel'))}</button><button class="btn" type="submit">${esc(t('goal.save'))}</button></div></form>`;
    let done = false;
    const fin = v => { if (done) return; done = true; if (d.open) d.close(); res(v); };
    $('#fno').onclick = () => fin(null); d.onclose = () => fin(null);
    if (f) $('#fdel').onclick = () => fin('del');
    $('#ff').onsubmit = e => {
      e.preventDefault();
      const name = $('#fnm').value.trim(), amount = Math.round(parseFloat($('#fam').value) * 100) / 100;
      if (!name) return ($('#ferr').textContent = t('fee.errName'));
      if (!(amount > 0)) return ($('#ferr').textContent = t('fee.errAmt'));
      fin({ id: x.id || uid(), name, amount, category: $('#fct').value, term: $('#ftm').value.trim(), tag: $('#ftg').value.trim(), due: $('#fdu').value, official: $('#fof').checked });
    };
    d.showModal(); $('#fnm').focus();
  });
}

/* ---------- student screens ---------- */
student[''] = async () => {
  const rs = await myReceipts(), live = rs;
  const total = live.reduce((s, r) => s + Number(r.amount), 0), thisKey = monthKey(new Date());
  const month = live.filter(r => String(r.paid_on).startsWith(thisKey)).reduce((s, r) => s + Number(r.amount), 0);
  const nQ = rs.filter(r => r._queued).length;
  const first = (profile.full_name || '').split(' ')[0];
  const pd = new Date(); pd.setDate(1); pd.setMonth(pd.getMonth() - 1);
  const prev = live.filter(r => String(r.paid_on).startsWith(monthKey(pd))).reduce((s, r) => s + Number(r.amount), 0);
  view.innerHTML = `
    <h2 style="margin-top:4px">${first ? tH('dash.welcome', { name: first }) : esc(t('dash.welcome0'))}</h2>
    ${showingCache ? `<div class="banner info">${esc(t('net.showingSaved'))}</div>` : ''}
    ${queueBanner(nQ)}
    <div class="grid four">
      <div class="card stat"><div class="n">${peso(total)}</div><div class="l">${esc(t('stat.total'))}</div></div>
      <div class="card stat"><div class="n">${peso(month)}</div><div class="l">${esc(t('stat.month'))}</div></div>
      <div class="card stat"><div class="n">${rs.length}</div><div class="l">${esc(t('stat.count'))}</div></div>
      <div class="card stat"><div class="n">${nQ}</div><div class="l">${esc(t('status.queued'))}</div></div>
    </div>
    ${goalCard(month, prev)}
    ${feeMini(live)}
    <div class="card" style="margin-top:12px">
      <div class="chart-head"><b>${esc(t('chart.byMonth'))}</b>
        <div class="seg" id="range"><button type="button" data-n="6" class="${chartRange === 6 ? 'on' : ''}">${esc(t('chart.m6'))}</button><button type="button" data-n="12" class="${chartRange === 12 ? 'on' : ''}">${esc(t('chart.m12'))}</button></div></div>
      <div id="chartbox">${chartHTML(live, chartRange)}</div>
    </div>
    <div class="card"><div class="chart-head"><b>${esc(t('chart.byCat'))}</b></div>${catHTML(live)}</div>
    <h2>${esc(t('dash.recent'))}</h2>
    ${rs.length ? `<div class="list">${rs.slice(0, 5).map(r => itemHTML(r)).join('')}</div>`
      : `<div class="card empty">${esc(t('dash.none'))}<br>${esc(t('dash.noneHint'))}</div>`}`;
  bindItems(); bindQueueBanner();
  $('#goalEdit').onclick = async () => {
    const v = await askNumber(t('goal.ask'), Number(lsGet(goalKey())) || '');
    if (v === null) return; if (v) lsSet(goalKey(), String(v)); else lsDel(goalKey()); cloudSave(); render();
  };
  view.querySelectorAll('#range button').forEach(b => b.onclick = () => {
    chartRange = +b.dataset.n;
    view.querySelectorAll('#range button').forEach(x => x.classList.toggle('on', x === b));
    $('#chartbox').innerHTML = chartHTML(live, chartRange);
  });
};

student['fees'] = async () => {
  const rs = await myReceipts(), fees = getFees(), T = feeTotals(fees, rs), sb_ = lsJSON(schoolKey());
  const allOfficial = fees.length && fees.every(f => f.official);
  const keyOf = { term: f => f.term || t('fee.none'), cat: f => catName(f.category), tag: f => f.tag || t('fee.none') }[feeBy];
  const groups = {};
  fees.forEach(f => { const g = groups[keyOf(f)] ||= { exp: 0, got: 0, fs: [] }; g.exp += f.amount; g.got += Math.min(T.paid[f.id], f.amount); g.fs.push(f); });
  const rows = Object.entries(groups).map(([k, g]) => {
    const left = Math.max(0, g.exp - g.got), p = g.exp ? g.got / g.exp * 100 : 0;
    return `<div class="cat"><div class="cat-top"><span>${esc(k)} ${feeBadge(g.fs)}</span><b>${left ? esc(t('fee.left', { a: peso(left) })) : esc(t('fee.settled'))}</b></div>
      <div class="cat-bar"><div class="cat-track"><div class="cat-fill" style="width:${p.toFixed(1)}%"></div></div><span class="cat-pct">${Math.round(p)}%</span></div>
      <div class="note">${esc(t('fee.of', { p: peso(g.got), e: peso(g.exp) }))}</div></div>`;
  }).join('');
  let school = `<p class="note" style="margin:0 0 8px">${esc(t('fee.schoolHint'))}</p>`;
  if (sb_) {
    const diff = Math.abs(T.bal - sb_.amount);
    school = `<div class="slip-amt" style="margin:4px 0"><b>${peso(sb_.amount)}</b><span>${esc(t('fee.schoolAsOf', { d: fmtDate(sb_.asOf) }))}</span></div>
      <div class="note" style="margin-bottom:8px">${esc(diff < 0.5 ? t('fee.match') : t('fee.diff', { a: peso(diff) }))}</div>`;
  }
  view.innerHTML = `
    <div class="chart-head" style="margin-top:4px"><h2 style="margin:0">${esc(t('fee.title'))}</h2><button class="btn small" id="fadd">+ ${esc(t('fee.add'))}</button></div>
    ${!fees.length ? `<div class="card empty">${esc(t('fee.empty'))}<br><span class="note">${esc(t('fee.emptyHint'))}</span></div>` : `
    <div class="card slip" style="margin-top:12px"><div class="chart-head"><b>${esc(t(allOfficial ? 'fee.balOfficial' : 'fee.balEst'))}</b>${feeBadge(fees)}</div>
      <div class="slip-amt"><b>${peso(T.bal)}</b><span>${esc(t('fee.progress'))} ${Math.round(T.pct)}%</span></div>
      <div class="cat-track slip-track"><div class="cat-fill" style="width:${T.pct.toFixed(1)}%"></div></div>
      <div class="note">${esc(t(allOfficial ? 'fee.officialNote' : 'fee.estNote'))}</div></div>
    <div class="grid" style="margin-top:12px"><div class="card stat"><div class="n">${peso(T.exp)}</div><div class="l">${esc(t('fee.expected'))}</div></div>
      <div class="card stat"><div class="n">${peso(T.got)}</div><div class="l">${esc(t('fee.paid'))}</div></div></div>
    ${T.unassigned > 0.005 ? `<div class="banner info" style="margin-top:12px">${esc(t('fee.unassigned', { a: peso(T.unassigned) }))}</div>` : ''}
    <div class="card" style="margin-top:12px"><div class="chart-head"><b>${esc(t('fee.by'))}</b>
      <div class="seg" id="by">${[['term', 'fee.byTerm'], ['cat', 'fee.byCat'], ['tag', 'fee.byTag']].map(([v, k]) => `<button type="button" data-v="${v}" class="${v === feeBy ? 'on' : ''}">${esc(t(k))}</button>`).join('')}</div></div>${rows}</div>
    <div class="card"><div class="chart-head"><b>${esc(t('fee.school'))}</b>${sb_ ? `<button type="button" class="linkbtn" id="sclr">${esc(t('fee.clear'))}</button>` : ''}</div>${school}
      <button type="button" class="btn small sec" id="sset">${esc(t('fee.schoolSet'))}</button></div>
    <h2>${esc(t('fee.list'))}</h2>
    <div class="list">${fees.map(f => `<button class="item" data-fid="${esc(f.id)}"><div class="mid"><div class="t">${esc(f.name)}</div>
      <div class="s">${esc([f.term, catName(f.category), f.tag, f.due ? t('fee.dueOn', { d: fmtDate(f.due) }) : ''].filter(Boolean).join(' · '))}</div><div class="s">${feeBadge([f])}</div></div>
      <div class="amt">${peso(f.amount)}</div></button>`).join('')}</div>
    <p class="note" style="margin-top:12px">${esc(t('fee.device'))}</p>`}`;
  const edit = async f => {
    const v = await feeDialog(f); if (v === null) return;
    const all = getFees().filter(x => !f || x.id !== f.id);
    if (v !== 'del') all.splice(f ? Math.max(0, getFees().findIndex(x => x.id === f.id)) : all.length, 0, v);
    saveFees(all); toast(t(v === 'del' ? 'fee.removed' : 'fee.saved')); render();
  };
  $('#fadd').onclick = () => edit(null);
  view.querySelectorAll('[data-fid]').forEach(b => b.onclick = () => edit(fees.find(f => f.id === b.dataset.fid)));
  view.querySelectorAll('#by button').forEach(b => b.onclick = () => { feeBy = b.dataset.v; render(); });
  const ss = $('#sset'); if (ss) ss.onclick = async () => {
    const v = await askNumber(t('fee.schoolAsk'), sb_ ? sb_.amount : ''); if (v === null) return;
    lsSet(schoolKey(), JSON.stringify({ amount: v, asOf: todayISO() })); cloudSave(); render();
  };
  const sc = $('#sclr'); if (sc) sc.onclick = () => { lsDel(schoolKey()); cloudSave(); render(); };
};

student['receipts'] = async () => {
  const rs = await myReceipts(), nQ = rs.filter(r => r._queued).length;
  view.innerHTML = `
    <h2 style="margin-top:4px">${esc(t('list.title'))}</h2>
    ${showingCache ? `<div class="banner info">${esc(t('net.showingSaved'))}</div>` : ''}
    ${queueBanner(nQ)}
    <div class="filters">
      <input id="q" class="full" type="search" placeholder="${esc(t('list.search'))}" aria-label="${esc(t('list.search'))}">
      <select id="fc" class="full" aria-label="${esc(t('form.cat'))}"><option value="">${esc(t('list.allCats'))}</option>${CATEGORIES.map(c => `<option value="${esc(c)}">${esc(catName(c))}</option>`).join('')}</select>
      <div><label for="fd1" style="margin-top:0">${esc(t('list.from'))}</label><input id="fd1" type="date"></div>
      <div><label for="fd2" style="margin-top:0">${esc(t('list.to'))}</label><input id="fd2" type="date"></div>
      <select id="fs" class="full" aria-label="Sort"><option value="new">${esc(t('list.new'))}</option><option value="old">${esc(t('list.old'))}</option><option value="hi">${esc(t('list.hi'))}</option></select>
    </div>
    <div class="sumbar"><span id="sum"></span><button type="button" class="btn small sec" id="csv">${esc(t('list.export'))}</button></div>
    <div id="out" class="list"></div>`;
  bindQueueBanner();
  let shown = rs;
  $('#csv').onclick = () => exportCSV(shown);
  const draw = () => {
    const q = $('#q').value.trim().toLowerCase(), c = $('#fc').value, d1 = $('#fd1').value, d2 = $('#fd2').value, s = $('#fs').value;
    const list = rs.filter(r =>
      (!q || (r.description + ' ' + (r.receipt_no || '') + ' ' + r.category).toLowerCase().includes(q)) &&
      (!c || r.category === c) && (!d1 || r.paid_on >= d1) && (!d2 || r.paid_on <= d2));
    if (s === 'old') list.reverse(); else if (s === 'hi') list.sort((a, b) => b.amount - a.amount);
    shown = list;
    $('#sum').textContent = t('list.sum', { n: list.length, a: peso(list.reduce((s, r) => s + Number(r.amount), 0)) });
    $('#csv').disabled = !list.length;
    $('#out').innerHTML = list.length ? list.map(r => itemHTML(r)).join('') : `<div class="card empty">${esc(t('list.none'))}</div>`;
    bindItems($('#out'));
  };
  $('.filters').addEventListener('input', draw); $('.filters').addEventListener('change', draw);
  draw();
};

async function getReceipt(id) {
  const { data, error } = await sb.from('receipts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (data) await signed([data.image_path]);
  return data;
}
function details(r) {
  const src = photoSrc(r);
  return `
    <h2 style="margin:0 0 4px">${esc(r.description)}</h2>
    <div style="font-size:1.6rem;font-weight:800;color:var(--brand)">${peso(r.amount)}</div>
    <dl class="kv">
      <dt>${esc(t('rec.date'))}</dt><dd>${fmtDate(r.paid_on)}</dd>
      <dt>${esc(t('rec.cat'))}</dt><dd>${esc(catName(r.category))}</dd>
      <dt>${esc(t('rec.no'))}</dt><dd>${esc(r.receipt_no) || '—'}</dd>
      ${r._queued ? `<dt>${esc(t('rec.status'))}</dt><dd>${pill(r)}</dd>` : ''}
      ${r.notes ? `<dt>${esc(t('rec.notes'))}</dt><dd>${esc(r.notes)}</dd>` : ''}
    </dl>
    ${src ? `<div class="photo"><img class="preview" id="pimg" alt="${esc(t('rec.alt'))}" src="${esc(src)}"><button type="button" class="eye" id="viewphoto" aria-label="${esc(t('rec.viewLarge'))}">${EYE}</button></div>` : `<p class="note">${esc(t('rec.noPhoto'))}</p>`}`;
}
async function downloadPhoto(r) {
  const resp = await fetch(urlCache.get(r.image_path)), b = await resp.blob();
  const a = document.createElement('a'); a.href = URL.createObjectURL(b);
  a.download = `${r.paid_on}_${r.description}`.replace(/[^\w.-]+/g, '_') + '.jpg'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const goBack = fallback => () => (history.length > 1 ? history.back() : (location.hash = fallback));

student['receipt'] = async id => {
  const r = await getReceipt(id);
  if (!r) { view.innerHTML = `<div class="card empty">${esc(t('rec.notFound'))}</div>`; return; }
  view.innerHTML = `
    <div class="row noprint" style="margin-bottom:8px"><button class="btn small ghost" id="back">${esc(t('rec.back'))}</button></div>
    <div class="card">${details(r)}
      <div class="row noprint" style="margin-top:14px">
        ${r.image_path ? `<button class="btn" id="dl">${esc(t('rec.download'))}</button><button class="btn sec" id="pr">${esc(t('rec.print'))}</button>` : ''}
        ${r.image_path && navigator.share ? `<button class="btn sec" id="sh">${esc(t('rec.share'))}</button>` : ''}<button class="btn sec" id="dup">${esc(t('rec.dup'))}</button><button class="btn sec" id="ed">${esc(t('rec.edit'))}</button><button class="btn danger" id="rm">${esc(t('rec.delete'))}</button>
      </div>
    </div>`;
  $('#back').onclick = goBack('#/receipts');
  bindPhoto();
  if (r.image_path) {
    $('#dl').onclick = () => downloadPhoto(r).catch(() => toast(t('rec.downloadFail')));
    $('#pr').onclick = () => window.print();
  }
  {
    $('#ed').onclick = () => { location.hash = '#/edit/' + r.id; };
    $('#dup').onclick = () => { location.hash = '#/add/' + r.id; };
    const sh = $('#sh'); if (sh) sh.onclick = () => shareReceipt(r).catch(e => { if (!e || e.name !== 'AbortError') toast(t('rec.shareFail')); });
    $('#rm').onclick = async () => {
      if (!await ask(t('rec.confirmDelete'), t('rec.delete'))) return;
      const { data: gone, error } = await sb.from('receipts').delete().eq('id', r.id).select('id');
      if (error) return toast(errText(error));
      /* RLS can block a delete without an error: it just removes 0 rows */
      if (!gone || !gone.length) return toast(t('rec.deleteFail'));
      if (r.image_path) { try { await sb.storage.from(BUCKET).remove([r.image_path]); } catch { /* photo cleanup is best effort */ } }
      const ck = 'rs-cache-' + curUser().id, c = lsJSON(ck);
      if (c) lsSet(ck, JSON.stringify(c.filter(x => x.id !== r.id)));
      toast(t('rec.deleted')); location.hash = '#/receipts';
    };
  }
};

/* a receipt that is saved on this phone and has not uploaded yet */
student['queued'] = async qid => {
  const it = await ob.get(qid).catch(() => null);
  if (!it) { location.hash = '#/receipts'; return; }
  const r = toPseudo(it);
  view.innerHTML = `
    <div class="row" style="margin-bottom:8px"><button class="btn small ghost" id="back">${esc(t('rec.back'))}</button></div>
    <div class="card">${details(r)}
      <p class="note">${esc(t('net.queuedNote'))}</p>
      <div class="row" style="margin-top:10px">
        <button class="btn" id="up">${esc(t('net.uploadNow'))}</button>
        <button class="btn danger" id="rm">${esc(t('rec.delete'))}</button>
      </div>
    </div>`;
  $('#back').onclick = goBack('#/receipts');
  bindPhoto();
  $('#up').onclick = async () => { $('#up').disabled = true; await syncQueue(true); location.hash = '#/receipts'; render(); };
  $('#rm').onclick = async () => {
    if (!await ask(t('rec.confirmDelete'), t('rec.delete'))) return;
    await ob.del(qid); toast(t('rec.deleted')); location.hash = '#/receipts';
  };
};

function form(existing, prefill) {
  const r = existing || prefill || { description: '', amount: '', paid_on: todayISO(), category: CATEGORIES[2], receipt_no: '', notes: '' };
  const hasRemote = existing && existing.image_path && urlCache.get(existing.image_path);
  view.innerHTML = `
    <h2 style="margin-top:4px">${esc(existing ? t('form.edit') : t('form.add'))}</h2>
    <form id="f" class="card" novalidate>
      <label for="desc">${esc(t('form.desc'))}</label>
      <input id="desc" required maxlength="120" placeholder="${esc(t('form.descPh'))}" value="${esc(r.description)}">
      <label for="amt">${esc(t('form.amount'))}</label>
      <input id="amt" required type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="150.00" value="${esc(r.amount)}">
      <label for="date">${esc(t('form.date'))}</label>
      <input id="date" required type="date" max="${todayISO()}" value="${esc(String(r.paid_on).slice(0, 10))}">
      <label for="cat">${esc(t('form.cat'))}</label>
      <select id="cat">${CATEGORIES.map(c => `<option value="${esc(c)}" ${c === r.category ? 'selected' : ''}>${esc(catName(c))}</option>`).join('')}</select>
      <div id="flwrap" hidden><label for="fl">${esc(t('fee.pick'))}</label><select id="fl"></select><div class="note">${esc(t('fee.pickHint'))}</div></div>
      <label for="no">${esc(t('form.no'))} <span class="note">${esc(t('form.noHint'))}</span></label>
      <input id="no" maxlength="40" value="${esc(r.receipt_no)}">
      <label for="notes">${esc(t('form.notes'))} <span class="note">${esc(t('form.optional'))}</span></label>
      <textarea id="notes" rows="2" maxlength="300">${esc(r.notes)}</textarea>
      <div class="lbl">${esc(t('form.photo'))}</div>
      <div class="row">
        <button type="button" class="btn sec" id="takePhoto">${esc(t('form.take'))}</button>
        <button type="button" class="btn sec" id="pickPhoto">${esc(t('form.choose'))}</button>
      </div>
      <div id="fname" class="note" style="margin-top:6px">${esc(hasRemote ? t('form.photoKept') : t('form.noPhoto'))}</div>
      <input id="photoCam" type="file" accept="image/*" capture="environment" hidden>
      <input id="photoFile" type="file" accept="image/*" hidden>
      <img id="pv" class="preview" alt="" ${hasRemote ? `src="${esc(urlCache.get(existing.image_path))}"` : 'hidden'}>
      <div class="row" id="photoTools" style="margin-top:8px" hidden>
        <button type="button" class="btn small sec" id="editBtn">${esc(t('form.editPhoto'))}</button>
        <button type="button" class="btn small" id="ocrBtn">${esc(t('form.autofill'))}</button>
      </div>
      <div id="ocrmsg" class="note" role="status" style="margin-top:6px"></div>
      <div id="err" class="err" role="alert"></div>
      <div class="row" style="margin-top:16px"><button class="btn" type="submit" id="save">${esc(existing ? t('form.saveResubmit') : t('form.submit'))}</button>
        <button class="btn ghost" type="button" id="cancel">${esc(t('form.cancel'))}</button></div>
    </form>
`;
  let pending = null, srcCanvas = null;
  const dirty = { date: false, cat: false };
  $('#date').addEventListener('input', () => { dirty.date = true; });
  $('#cat').addEventListener('change', () => { dirty.cat = true; });
  view.querySelectorAll('input,select').forEach(el => el.addEventListener('input', () => el.classList.remove('filled')));
  const err = m => { $('#err').textContent = m; };

  const fillFl = () => {
    const c = $('#cat').value, fs = getFees().filter(f => f.category === c), cur = existing && (lsJSON(linkKey()) || {})[existing.id];
    const keep = $('#fl').value || cur || '';
    $('#flwrap').hidden = !fs.length;
    $('#fl').innerHTML = `<option value="">${esc(t('fee.auto'))}</option>` + fs.map(f => `<option value="${esc(f.id)}" ${f.id === keep ? 'selected' : ''}>${esc(f.name + (f.term ? ' · ' + f.term : ''))}</option>`).join('');
  };
  $('#cat').addEventListener('change', fillFl); fillFl();
  const setPhoto = (blob, name) => {
    pending = blob;
    $('#pv').src = localUrl(blob); $('#pv').hidden = false;
    $('#fname').textContent = name || ''; $('#photoTools').hidden = false; $('#ocrmsg').textContent = ''; err('');
  };
  const onPick = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const c = await loadImageToCanvas(f), blob = await editPhoto(c);
      if (!blob) return;
      srcCanvas = c; setPhoto(blob, f.name);
    } catch (x) { err(errText(x)); }
  };
  $('#photoCam').addEventListener('change', onPick);
  $('#photoFile').addEventListener('change', onPick);
  $('#takePhoto').onclick = () => $('#photoCam').click();
  $('#pickPhoto').onclick = () => $('#photoFile').click();
  $('#editBtn').onclick = async () => { if (!srcCanvas) return; const b = await editPhoto(srcCanvas); if (b) setPhoto(b, $('#fname').textContent); };

  $('#ocrBtn').onclick = async () => {
    if (!pending) return;
    const btn = $('#ocrBtn'), msg = $('#ocrmsg'); btn.disabled = true; msg.textContent = t('ocr.reading');
    try {
      await loadTesseract();
      const res = await window.Tesseract.recognize(pending, 'eng', { logger: m => { if (m.status === 'recognizing text') msg.textContent = t('ocr.pct', { p: Math.round(m.progress * 100) }); } });
      const f = parseReceiptText(res.data.text); let n = 0;
      const put = (id, val) => { const el = $('#' + id); el.value = val; el.classList.add('filled'); n++; };
      if (f.amount && !$('#amt').value) put('amt', f.amount.toFixed(2));
      if (f.date && !dirty.date) put('date', f.date);
      if (f.receiptNo && !$('#no').value.trim()) put('no', f.receiptNo);
      if (f.category && !dirty.cat) put('cat', f.category);
      msg.textContent = n ? t('ocr.done', { n }) : t('ocr.nothing');
    } catch { msg.textContent = navigator.onLine ? t('ocr.fail') : t('ocr.needNet'); }
    finally { btn.disabled = false; }
  };
  $('#cancel').onclick = () => history.back();

  $('#f').addEventListener('submit', async e => {
    e.preventDefault();
    const description = $('#desc').value.trim(), amount = parseFloat($('#amt').value), paid_on = $('#date').value;
    if (!description) return err(t('form.errDesc'));
    if (!(amount > 0)) return err(t('form.errAmount'));
    if (!paid_on) return err(t('form.errDate'));
    if (!existing && !pending) return err(t('form.errPhoto'));
    const row = { description, amount: Math.round(amount * 100) / 100, paid_on, category: $('#cat').value, receipt_no: $('#no').value.trim() || null, notes: $('#notes').value.trim() || null };
    const userId = curUser().id, fl = $('#fl').value;
    const linkIt = id => { const m = lsJSON(linkKey()) || {}; if (fl) m[id] = fl; else delete m[id]; lsSet(linkKey(), JSON.stringify(m)); cloudSave(); };
    $('#save').disabled = true;
    try {
      if (existing) {
        if (!navigator.onLine) throw new Error(t('net.editNeedsNet'));
        let newPath = null;
        if (pending) {
          newPath = `${userId}/${uid()}.jpg`;
          const up = await sb.storage.from(BUCKET).upload(newPath, pending, { contentType: 'image/jpeg', upsert: false });
          if (up.error) throw up.error;
          row.image_path = newPath;
        }
        const { error } = await sb.from('receipts').update(row).eq('id', existing.id);
        if (error) { if (newPath) await sb.storage.from(BUCKET).remove([newPath]); throw error; }
        if (newPath && existing.image_path) await sb.storage.from(BUCKET).remove([existing.image_path]);
        linkIt(existing.id); toast(t('form.resubmitted')); location.replace('#/receipt/' + existing.id);
        return;
      }
      /* new receipt: warn about look-alikes (this phone's waiting list is checked too) */
      try {
        const { data: mine } = await sb.from('receipts').select('description,amount,paid_on,category,receipt_no');
        const all = [...(mine || []), ...(await queuedItems()).map(i => i.row)];
        const same = all.find(x => (row.receipt_no && x.receipt_no === row.receipt_no) || (Number(x.amount) === row.amount && x.paid_on === paid_on && x.category === row.category));
        if (same && !await ask(t('form.similar', { d: same.description, a: peso(same.amount) }), t('form.saveAnyway'), false)) { $('#save').disabled = false; return; }
      } catch { /* skip the check when offline */ }
      const rid = uid(), path = pending ? `${userId}/${rid}.jpg` : null;
      linkIt(rid);
      let uploaded = false;
      try {
        if (!navigator.onLine) throw new TypeError('Failed to fetch');
        if (pending) {
          const up = await sb.storage.from(BUCKET).upload(path, pending, { contentType: 'image/jpeg', upsert: false });
          if (up.error) throw up.error;
          uploaded = true;
        }
        const { error } = await sb.from('receipts').insert({ ...row, id: rid, user_id: userId, image_path: path });
        if (error) throw error;
        location.replace('#/receipt/' + rid); feeNote(row.category).then(n => toast(t('form.submitted') + n));
      } catch (x) {
        if (isNetErr(x)) {
          await ob.put({ qid: rid, userId, row, blob: pending, imagePath: uploaded ? path : null, createdAt: Date.now() });
          toast(t('net.saved')); location.replace('#/receipts');
        } else {
          if (uploaded) await sb.storage.from(BUCKET).remove([path]);
          throw x;
        }
      }
    } catch (x) { err(t('form.couldNot', { m: errText(x) })); $('#save').disabled = false; }
  });
}
student['add'] = async id => {
  const src = id ? await getReceipt(id).catch(() => null) : null;
  form(null, src && { ...src, paid_on: todayISO(), receipt_no: '', image_path: null });
};
student['edit'] = async id => {
  if (!navigator.onLine) { toast(t('net.editNeedsNet')); location.hash = '#/receipts'; return; }
  const r = await getReceipt(id);
  if (!r) { location.hash = '#/receipts'; return; }
  form(r);
};

/* ---------- account ---------- */
student['account'] = async () => {
  const u = curUser();
  const seg = (id, items, cur) => `<div class="seg" id="${id}">${items.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === cur ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
  view.innerHTML = `
    <h2 style="margin-top:4px">${esc(t('acct.title'))}</h2>
    <form id="pf" class="card" novalidate>
      <dl class="kv" style="margin-top:0">
        <dt>${esc(t('acct.email'))}</dt><dd>${esc(u.email)}</dd>
      </dl>
      <label for="fn">${esc(t('acct.fullName'))}</label><input id="fn" maxlength="80" value="${esc(profile.full_name)}">
      <div id="err" class="err" role="alert"></div>
      <div class="row" style="margin-top:12px"><button class="btn sec" type="submit">${esc(t('acct.saveName'))}</button></div>
    </form>
    <div class="card">
      <b>${esc(t('acct.prefs'))}</b>
      <div class="lbl">${esc(t('acct.lang'))}</div>${seg('sl', [['en', 'English'], ['fil', 'Filipino']], lang)}
      <div class="lbl">${esc(t('acct.theme'))}</div>${seg('st', [['auto', t('acct.auto')], ['light', t('acct.light')], ['dark', t('acct.dark')]], theme)}
    </div>
    <div class="card"><button class="btn danger" id="out">${esc(t('acct.logout'))}</button></div>`;
  $('#pf').addEventListener('submit', async e => {
    e.preventDefault();
    const full_name = $('#fn').value.trim();
    const { error } = await sb.from('profiles').update({ full_name }).eq('id', profile.id);
    if (error) return ($('#err').textContent = errText(error));
    profile.full_name = full_name; lsSet('rs-profile-' + u.id, JSON.stringify(profile)); toast(t('acct.saved')); shell('account');
  });
  $('#sl').querySelectorAll('button').forEach(b => b.onclick = () => setLang(b.dataset.v));
  $('#st').querySelectorAll('button').forEach(b => b.onclick = () => { setTheme(b.dataset.v); $('#st').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#out').onclick = async () => { if (lsGet('rs-push') === '1') { try { await disablePush(); } catch { /* best effort */ } } await sb.auth.signOut(); location.hash = '#/'; };
};

/* ---------- start ---------- */
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(console.warn));
boot();
})();