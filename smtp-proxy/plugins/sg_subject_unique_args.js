// Adds X-SMTPAPI header with unique_args.email_subject for SendGrid SMTP
exports.register = function () {
    this.register_hook('data_post', 'add_unique_args_header');
  };
  
  exports.add_unique_args_header = function (next, connection) {
    try {
      const txn = connection.transaction;
      if (!txn) return next();
      const subject = txn.header?.get('Subject') || '';
      const trimmed = String(subject).slice(0, 512);
      const existing = txn.header.get('X-SMTPAPI');
      let xobj = {};
      if (existing) try { xobj = JSON.parse(existing); } catch {}
      xobj.unique_args = { ...(xobj.unique_args || {}), email_subject: trimmed };
      const updated = JSON.stringify(xobj);
      if (existing) txn.remove_header('X-SMTPAPI');
      txn.add_header('X-SMTPAPI', updated);
      this.loginfo(`Injected unique_args.email_subject="${trimmed}"`);
      return next();
    } catch (e) {
      this.logerror(`sg_subject_unique_args error: ${e.message}`);
      return next();
    }
  };