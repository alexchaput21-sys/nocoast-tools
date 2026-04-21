/**
 * No Coast Custom Upholstery — AI Receptionist Webhook Handler
 *
 * Add this code to your existing Google Apps Script project.
 * Your existing doGet() function handles the CRM (getLeads, addLead, etc.).
 * This doPost() function handles incoming webhooks from your AI receptionist (Rosie, Trillet, etc.)
 *
 * Once deployed, your webhook URL is the same Apps Script exec URL you already use in the CRM.
 * Just paste it into your AI receptionist's webhook settings.
 *
 * Optional: set a WEBHOOK_SECRET in Script Properties (Project Settings > Script Properties)
 * and enter the same value in your AI receptionist's webhook settings for added security.
 */

function doPost(e) {
  try {
    // ── Optional secret verification ──────────────────────────────────────────
    var secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (secret) {
      var incoming = e.parameter['secret'] || (e.postData ? JSON.parse(e.postData.contents || '{}')['secret'] : null);
      if (incoming !== secret) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
    }

    // ── Parse incoming payload ────────────────────────────────────────────────
    var payload = {};
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    // Normalize field names across different AI receptionist services
    var callerName  = payload.caller_name   || payload.name          || payload.contact_name  || 'Unknown Caller';
    var callerPhone = payload.caller_phone  || payload.caller_number  || payload.phone         || payload.phone_number || '';
    var summary     = payload.message       || payload.summary        || payload.transcript    || payload.notes        || '';
    var timestamp   = payload.timestamp     || payload.call_time      || new Date().toISOString();

    // ── Build lead object ─────────────────────────────────────────────────────
    var callDate = Utilities.formatDate(new Date(timestamp), Session.getScriptTimeZone(), 'MMM d, yyyy');
    var notes = '📞 Phone call received ' + callDate;
    if (summary) notes += '\nSummary: ' + summary;

    var lead = {
      customerName:  callerName,
      contact:       callerPhone,
      vehicle:       extractVehicle(summary),
      workType:      extractWorkType(summary),
      source:        'Phone Call',
      status:        'New Lead',
      estValue:      '',
      depositAmount: '',
      notes:         notes
    };

    // ── Write to Google Sheet ─────────────────────────────────────────────────
    // This calls your existing addLead logic. Replace 'addLeadToSheet' with whatever
    // your current function is named that writes a row to the sheet.
    var result = addLeadToSheet(lead);

    return jsonResponse({ success: true, message: 'Lead created for ' + callerName });

  } catch (err) {
    Logger.log('Webhook error: ' + err.message);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a JSON ContentService response.
 */
function jsonResponse(obj, statusCode) {
  // Note: Apps Script doPost can't set HTTP status codes directly,
  // but we include it in the body so you can inspect it in logs.
  obj.statusCode = statusCode || 200;
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Attempts to extract a vehicle or item description from the call summary.
 */
function extractVehicle(summary) {
  if (!summary) return 'See notes';

  var patterns = [
    /\d{4}\s+[A-Za-z]+\s+[A-Za-z0-9\-]+/,         // "2018 Ford F-150"
    /\b(boat|pontoon|jet ski|waverunner|kayak)\b/i,
    /\b(motorcycle|harley|honda|kawasaki|yamaha|ducati|bmw)\b/i,
    /\b(atv|utv|side[- ]by[- ]side|rzr|can[- ]am|polaris)\b/i,
    /\b(snowmobile|sled|ski[- ]doo|arctic cat)\b/i,
    /\b(bar stool|kitchen chair|counter stool)\b/i
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = summary.match(patterns[i]);
    if (match) return match[0].trim();
  }

  return 'See notes';
}

/**
 * Attempts to extract work type keywords from the call summary.
 */
function extractWorkType(summary) {
  if (!summary) return '';

  var lower = summary.toLowerCase();
  var types = [];

  if (/seat/.test(lower))             types.push('Seat Restoration');
  if (/door panel/.test(lower))       types.push('Door Panels');
  if (/headliner/.test(lower))        types.push('Headliner');
  if (/dashboard|dash/.test(lower))   types.push('Dashboard');
  if (/console/.test(lower))          types.push('Center Console');
  if (/carpet/.test(lower))           types.push('Carpet');
  if (/convert|top/.test(lower))      types.push('Convertible Top');
  if (/cushion/.test(lower))          types.push('Cushions');
  if (/embroid/.test(lower))          types.push('Embroidery');
  if (/custom/.test(lower))           types.push('Custom Work');

  return types.join(', ');
}
