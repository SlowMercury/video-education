(() => {
  'use strict';

  const panels = [];
  const ownerDialog = document.getElementById('owner-dialog');
  const ownerForm = document.getElementById('owner-form');
  const ownerPassword = document.getElementById('owner-password');
  const ownerStatus = document.getElementById('owner-status');
  const ownerSubmit = document.getElementById('owner-submit');
  const ownerLogout = document.getElementById('owner-logout');
  const deleteDialog = document.getElementById('delete-dialog');
  const dateFormat = new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' });
  let session = { isOwner: false };
  let ownerBusy = false;
  let previousHash = location.hash === '#owner' ? '#main' : location.hash;
  let rememberedName = '';
  try { rememberedName = localStorage.getItem('video-education-name') || ''; } catch { /* Storage is optional. */ }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, className = 'discussion-link') {
    const node = element('button', className, text);
    node.type = 'button';
    return node;
  }

  function status(node, message = '', isError = false) {
    node.textContent = message;
    node.classList.toggle('discussion-error', isError);
  }

  async function request(path, { method = 'GET', body, csrf } = {}) {
    if (!['http:', 'https:'].includes(location.protocol)) throw new Error('Обсуждения доступны на опубликованном сайте.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, {
        method, credentials: 'same-origin', signal: controller.signal,
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) {
        let message = data.error?.message || 'Не удалось выполнить действие. Попробуйте ещё раз.';
        if (response.status === 429) {
          const minutes = Math.max(1, Math.ceil(Number(response.headers.get('Retry-After') || 60) / 60));
          message = `Слишком много запросов. Повторите примерно через ${minutes} мин.`;
        }
        throw Object.assign(new Error(message), { status: response.status, code: data.error?.code });
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError || error instanceof SyntaxError) {
        throw new Error('Нет ответа от сервера. Проверьте соединение и повторите попытку.');
      }
      throw error;
    } finally { clearTimeout(timer); }
  }

  function setSession(value) {
    const changed = Boolean(session.isOwner) !== Boolean(value.isOwner) || session.displayName !== value.displayName;
    session = value;
    document.getElementById('owner-link').textContent = session.isOwner ? 'Кабинет автора' : 'Вход для автора';
    document.getElementById('owner-title').textContent = session.isOwner ? 'Кабинет автора' : 'Вход для автора';
    ownerForm.hidden = Boolean(session.isOwner);
    document.getElementById('owner-account').hidden = !session.isOwner;
    document.getElementById('owner-identity').textContent = session.isOwner ? `Вы вошли как ${session.displayName}.` : '';
    panels.forEach(panel => {
      panel.updateIdentity();
      if (changed) panel.render();
    });
  }

  async function refreshSession() {
    const current = await request('/api/owner/session');
    setSession(current);
    return current;
  }

  function rememberName(name) {
    const oldName = rememberedName;
    rememberedName = name;
    try { localStorage.setItem('video-education-name', name); } catch { /* Posting works without storage. */ }
    panels.forEach(panel => { if (!panel.name.value || panel.name.value === oldName) panel.name.value = name; });
  }

  function confirmDeletion(comment) {
    return new Promise(resolve => {
      document.getElementById('delete-preview').textContent = `${comment.displayName}: ${comment.body.slice(0, 600)}${comment.body.length > 600 ? '…' : ''}`;
      deleteDialog.returnValue = 'cancel';
      deleteDialog.addEventListener('close', () => resolve(deleteDialog.returnValue === 'delete'), { once: true });
      deleteDialog.showModal();
    });
  }

  class Discussion {
    constructor(container, discussionId, title) {
      this.id = discussionId;
      this.comments = new Map();
      this.cursor = null;
      this.loaded = false;
      this.loading = false;
      this.sending = false;
      this.parent = null;
      this.attempt = null;
      const prefix = `discussion-${discussionId.replace(':', '-')}`;
      this.root = element('section', 'discussion');
      this.root.dataset.discussionId = discussionId;
      this.root.setAttribute('aria-label', `Обсуждение: ${title}`);
      const headingRow = element('div', 'discussion-heading');
      this.heading = element('h3', '', 'Вопросы и комментарии');
      this.heading.tabIndex = -1;
      this.refresh = button('Обновить');
      this.refresh.addEventListener('click', () => this.load(true));
      headingRow.append(this.heading, this.refresh);
      this.root.append(headingRow, element('p', 'discussion-help', 'Спросите о непонятном или поделитесь своим опытом.'));

      this.form = element('form', 'discussion-form');
      this.form.setAttribute('aria-label', `Вопрос или комментарий: ${title}`);
      this.nameLabel = element('label', 'discussion-field discussion-name', 'Ваше имя');
      this.nameLabel.htmlFor = `${prefix}-name`;
      this.name = element('input');
      Object.assign(this.name, { id: `${prefix}-name`, name: 'displayName', type: 'text', maxLength: 60, required: true, autocomplete: 'nickname', value: rememberedName });
      this.nameLabel.append(this.name);
      this.identity = element('p', 'discussion-as-owner');
      this.identity.hidden = true;
      this.replying = element('div', 'discussion-replying');
      this.replying.hidden = true;
      this.replyLabel = element('span');
      this.cancelReply = button('Отменить ответ');
      this.cancelReply.addEventListener('click', () => { this.setReply(null); this.body.focus(); });
      this.replying.append(this.replyLabel, this.cancelReply);
      const bodyLabel = element('label', 'discussion-field', 'Вопрос или комментарий');
      bodyLabel.htmlFor = `${prefix}-body`;
      this.body = element('textarea');
      Object.assign(this.body, { id: `${prefix}-body`, name: 'body', rows: 3, maxLength: 5000, required: true, placeholder: 'Что хотите обсудить?' });
      bodyLabel.append(this.body);
      const actions = element('div', 'discussion-actions');
      this.submit = button('Опубликовать', 'discussion-button discussion-primary');
      this.submit.type = 'submit';
      const help = element('span', 'discussion-help', 'Без регистрации · Сообщения видны всем');
      help.id = `${prefix}-help`;
      this.body.setAttribute('aria-describedby', help.id);
      actions.append(this.submit, help);
      this.formStatus = element('p', 'discussion-status');
      this.formStatus.setAttribute('role', 'status');
      this.formStatus.setAttribute('aria-live', 'polite');
      this.form.append(this.nameLabel, this.identity, this.replying, bodyLabel, actions, this.formStatus);
      this.form.addEventListener('submit', event => { event.preventDefault(); this.publish(); });

      this.loadStatus = element('p', 'discussion-status');
      this.loadStatus.setAttribute('role', 'status');
      this.loadStatus.setAttribute('aria-live', 'polite');
      this.empty = element('p', 'discussion-help', 'Здесь пока тихо. Ваш вопрос может начать обсуждение.');
      this.empty.hidden = true;
      this.list = element('ol', 'comments-list');
      this.list.setAttribute('aria-label', 'Сообщения обсуждения');
      this.more = button('Показать ещё', 'discussion-button discussion-more');
      this.more.hidden = true;
      this.more.addEventListener('click', () => this.load());
      this.root.append(this.form, this.loadStatus, this.empty, this.list, this.more);
      container.append(this.root);
      this.updateIdentity();
    }

    updateIdentity() {
      this.nameLabel.hidden = Boolean(session.isOwner);
      this.name.required = !session.isOwner;
      this.identity.hidden = !session.isOwner;
      this.identity.textContent = session.isOwner ? `Вы отвечаете как ${session.displayName}` : '';
    }

    setReply(comment) {
      if (this.sending) return;
      this.parent = comment;
      this.replying.hidden = !comment;
      this.replyLabel.textContent = comment ? `Ответ для ${comment.displayName}` : '';
      this.submit.textContent = comment ? 'Опубликовать ответ' : 'Опубликовать';
    }

    load(reset = false) {
      if (this.loading) return this.loadTask;
      this.loadTask = this.fetchComments(reset);
      return this.loadTask;
    }

    async fetchComments(reset) {
      this.loading = true;
      this.refresh.disabled = this.more.disabled = true;
      this.list.setAttribute('aria-busy', 'true');
      status(this.loadStatus, 'Загрузка обсуждения…');
      try {
        const after = reset ? null : this.cursor;
        const data = await request(`/api/comments?discussionId=${encodeURIComponent(this.id)}&limit=20${after ? `&after=${after}` : ''}`);
        if (reset) this.comments.clear();
        data.comments.forEach(comment => this.comments.set(comment.id, comment));
        this.cursor = data.nextCursor;
        this.loaded = true;
        this.render();
        status(this.loadStatus, reset ? 'Обсуждение обновлено.' : after ? 'Показаны следующие сообщения.' : '');
        if (after && data.comments.length) document.getElementById(`comment-${data.comments[0].id}`)?.focus({ preventScroll: true });
      } catch (error) { status(this.loadStatus, `${error.message} Нажмите «Обновить», чтобы попробовать снова.`, true); }
      finally {
        this.loading = false;
        this.refresh.disabled = this.more.disabled = this.sending;
        this.list.setAttribute('aria-busy', 'false');
      }
    }

    async publish() {
      if (this.sending) return;
      if (!this.body.value.trim()) { this.body.setCustomValidity('Напишите вопрос или комментарий.'); this.body.reportValidity(); this.body.setCustomValidity(''); return; }
      if (!session.isOwner && !this.name.value.trim()) { this.name.setCustomValidity('Введите ваше имя.'); this.name.reportValidity(); this.name.setCustomValidity(''); return; }
      this.sending = true;
      this.submit.disabled = this.cancelReply.disabled = true;
      this.refresh.disabled = this.more.disabled = true;
      this.name.readOnly = this.body.readOnly = true;
      this.submit.textContent = 'Публикуем…';
      status(this.formStatus);
      const wasOwner = session.isOwner;
      try {
        await sessionReady;
        await refreshSession();
        if (wasOwner && !session.isOwner) throw new Error('Вход автора истёк. Войдите снова: текст сообщения сохранён.');
        if (this.loading) await this.loadTask;
        else if (!this.loaded) await this.load();
        const payload = { discussionId: this.id, parentId: this.parent?.id || null, displayName: session.isOwner ? session.displayName : this.name.value.trim().normalize('NFC'), body: this.body.value.trim().normalize('NFC') };
        const signature = JSON.stringify([payload, Boolean(session.isOwner)]);
        if (this.attempt?.signature !== signature) this.attempt = { signature, requestId: crypto.randomUUID() };
        const data = await request('/api/comments', { method: 'POST', body: { ...payload, requestId: this.attempt.requestId }, csrf: session.csrfToken });
        if (!session.isOwner) rememberName(payload.displayName);
        this.comments.set(data.comment.id, data.comment);
        this.attempt = null;
        this.body.value = '';
        this.parent = null;
        this.replying.hidden = true;
        this.render();
        status(this.formStatus, 'Сообщение опубликовано.');
        document.getElementById(`comment-${data.comment.id}`)?.focus({ preventScroll: true });
      } catch (error) {
        status(this.formStatus, `${error.message} Ваш текст сохранён в форме.`, true);
        if (error.status === 401 || error.code === 'invalid_csrf') refreshSession().catch(() => {});
      } finally {
        this.sending = false;
        this.submit.disabled = this.cancelReply.disabled = false;
        this.refresh.disabled = this.more.disabled = this.loading;
        this.name.readOnly = this.body.readOnly = false;
        this.submit.textContent = this.parent ? 'Опубликовать ответ' : 'Опубликовать';
      }
    }

    commentNode(comment) {
      const article = element('article', 'comment');
      article.id = `comment-${comment.id}`;
      article.tabIndex = -1;
      if (comment.deletedAt) {
        article.append(element('p', 'comment-deleted', 'Сообщение удалено автором курса.'));
        return article;
      }
      const header = element('div', 'comment-header');
      header.append(element('span', 'comment-name', comment.displayName));
      if (comment.isOwner) header.append(element('span', 'comment-owner', 'Автор курса'));
      const time = element('time', 'comment-date', dateFormat.format(new Date(comment.createdAt)));
      time.dateTime = comment.createdAt;
      header.append(time);
      article.append(header);
      if (comment.parentId) {
        const parent = this.comments.get(comment.parentId);
        const context = element('p', 'comment-context', 'В ответ на ');
        if (parent) {
          const link = element('a', '', parent.deletedAt ? 'удалённое сообщение' : `сообщение ${parent.displayName}`);
          link.href = `#comment-${parent.id}`;
          link.addEventListener('click', event => { event.preventDefault(); document.getElementById(`comment-${parent.id}`)?.focus(); });
          context.append(link);
        } else context.append(document.createTextNode('более раннее сообщение'));
        article.append(context);
      }
      article.append(element('p', 'comment-body', comment.body));
      const actions = element('div', 'comment-actions');
      const reply = button('Ответить');
      reply.addEventListener('click', () => { if (this.sending) return; this.setReply(comment); this.body.focus(); });
      actions.append(reply);
      if (session.isOwner) {
        const remove = button('Удалить');
        remove.addEventListener('click', async () => {
          if (remove.disabled || !await confirmDeletion(comment)) return;
          remove.disabled = true;
          try {
            await refreshSession();
            const data = await request(`/api/comments/${comment.id}`, { method: 'DELETE', csrf: session.csrfToken });
            this.comments.set(comment.id, data.comment);
            if (this.parent?.id === comment.id) this.setReply(null);
            this.render();
            status(this.loadStatus, 'Сообщение удалено.');
            this.heading.focus({ preventScroll: true });
          } catch (error) { status(this.loadStatus, error.message, true); remove.disabled = false; }
        });
        actions.append(remove);
      }
      article.append(actions);
      return article;
    }

    render() {
      const sorted = [...this.comments.values()].sort((a, b) => BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1);
      // Retain deleted ancestors only while a visible descendant needs their context.
      const visible = new Set();
      for (const comment of sorted) {
        if (comment.deletedAt) continue;
        let current = comment;
        while (current && !visible.has(current.id)) { visible.add(current.id); current = this.comments.get(current.parentId); }
      }
      // A deleted parent from the API may have replies on a later page.
      if (this.cursor) sorted.filter(comment => comment.deletedAt).forEach(comment => visible.add(comment.id));
      const children = new Map();
      const roots = [];
      for (const comment of sorted) {
        if (!visible.has(comment.id)) continue;
        if (this.comments.has(comment.parentId)) {
          if (!children.has(comment.parentId)) children.set(comment.parentId, []);
          children.get(comment.parentId).push(comment);
        } else roots.push(comment);
      }
      const fragment = document.createDocumentFragment();
      for (const root of roots) {
        const item = element('li');
        item.append(this.commentNode(root));
        const replies = element('ol', 'comment-replies');
        replies.setAttribute('aria-label', 'Ответы');
        // Flatten visual indentation; parent links retain the full reply context.
        const stack = [...(children.get(root.id) || [])].reverse();
        while (stack.length) {
          const child = stack.pop();
          const reply = element('li');
          reply.append(this.commentNode(child));
          replies.append(reply);
          stack.push(...[...(children.get(child.id) || [])].reverse());
        }
        if (replies.children.length) item.append(replies);
        fragment.append(item);
      }
      this.list.replaceChildren(fragment);
      this.empty.hidden = !this.loaded || visible.size !== 0;
      this.more.hidden = !this.cursor;
    }
  }

  document.querySelectorAll('section.lesson').forEach(section => {
    if (section.querySelector(':scope > .lesson-top > .chapter-number')) panels.push(new Discussion(section, `lesson:${section.id}`, section.querySelector('h2').textContent));
  });
  document.querySelectorAll('article.example[data-discussion-id]').forEach(article => panels.push(new Discussion(article, article.dataset.discussionId, article.querySelector('h3').textContent)));

  const sessionReady = refreshSession().catch(error => { status(ownerStatus, error.message, true); });
  if ('IntersectionObserver' in window) {
    const lazy = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const panel = panels.find(item => item.root === entry.target);
        panel.load();
        lazy.unobserve(entry.target);
      });
    }, { rootMargin: '250px' });
    panels.forEach(panel => lazy.observe(panel.root));
  } else panels.forEach(panel => panel.load());

  function showOwner() {
    if (location.hash !== '#owner') { previousHash = location.hash; location.hash = 'owner'; }
    if (!ownerDialog.open) ownerDialog.showModal();
    if (!session.isOwner) ownerPassword.focus();
    else ownerLogout.focus();
  }
  document.getElementById('owner-link').addEventListener('click', event => { event.preventDefault(); showOwner(); });
  document.getElementById('owner-close').addEventListener('click', () => ownerDialog.close());
  ownerDialog.addEventListener('close', () => {
    ownerPassword.value = '';
    if (location.hash === '#owner') history.replaceState(null, '', previousHash || location.pathname);
  });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#owner') showOwner();
    else { previousHash = location.hash; if (ownerDialog.open) ownerDialog.close(); }
  });
  if (location.hash === '#owner') showOwner();

  ownerForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (ownerBusy) return;
    ownerBusy = true;
    ownerSubmit.disabled = true;
    ownerSubmit.textContent = 'Входим…';
    status(ownerStatus);
    try {
      await sessionReady;
      const value = await request('/api/owner/session', { method: 'POST', body: { password: ownerPassword.value } });
      ownerPassword.value = '';
      setSession(value);
      status(ownerStatus, 'Вы вошли. Можно вернуться к обсуждениям.');
      document.getElementById('owner-close').focus();
    } catch (error) { status(ownerStatus, error.message, true); }
    finally { ownerBusy = false; ownerSubmit.disabled = false; ownerSubmit.textContent = 'Войти'; }
  });
  ownerLogout.addEventListener('click', async () => {
    if (ownerBusy) return;
    ownerBusy = true;
    ownerLogout.disabled = true;
    status(ownerStatus);
    try {
      await refreshSession();
      if (session.isOwner) await request('/api/owner/session', { method: 'DELETE', csrf: session.csrfToken });
      setSession({ isOwner: false });
      status(ownerStatus, 'Вы вышли из кабинета автора.');
      ownerPassword.focus();
    } catch (error) { status(ownerStatus, error.message, true); }
    finally { ownerBusy = false; ownerLogout.disabled = false; }
  });
})();
