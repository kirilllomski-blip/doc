/**
 * IceBel.by Contracts — Frontend Application Logic
 * ООО «АйсикБел»
 */

(function () {
  'use strict';

  // --- APPLICATION STATE ---
  const state = {
    items: [
      {
        id: generateId(),
        name: 'Кондиционер Daikin Emura 3 FTXJ20AW/RXJ20A',
        quantity: 1,
        price: 13706.50,
        warranty: 60,
      },
    ],
    buyer: {
      fio: '',
      phone: '',
      date: new Date().toISOString().slice(0, 10),
      address: '',
    },
    systemStatus: null,
  };

  function generateId() {
    return 'item_' + Math.random().toString(36).substr(2, 9);
  }

  // --- DOM REFERENCES ---
  const el = {
    btnTabCreate: document.getElementById('btn-tab-create'),
    btnTabJournal: document.getElementById('btn-tab-journal'),
    tabCreate: document.getElementById('tab-create'),
    tabJournal: document.getElementById('tab-journal'),
    journalCountBadge: document.getElementById('journal-count-badge'),
    statusDot: document.getElementById('status-dot'),
    statusLabel: document.getElementById('status-label'),

    inputFio: document.getElementById('input-fio'),
    btnClearFio: document.getElementById('btn-clear-fio'),
    inputPhone: document.getElementById('input-phone'),
    inputDate: document.getElementById('input-date'),
    inputAddress: document.getElementById('input-address'),
    chipMinsk: document.getElementById('chip-minsk'),
    chipHouse: document.getElementById('chip-house'),

    itemsTbody: document.getElementById('items-tbody'),
    btnAddItem: document.getElementById('btn-add-item'),
    quickItemsBar: document.getElementById('quick-items-bar'),

    labelContractNumber: document.getElementById('label-contract-number'),
    labelPreviewFio: document.getElementById('label-preview-fio'),
    labelItemsStats: document.getElementById('label-items-stats'),
    totalAmountDisplay: document.getElementById('total-amount-display'),
    totalWordsDisplay: document.getElementById('total-words-display'),

    btnDownloadDocx: document.getElementById('btn-download-docx'),
    btnSaveDrive: document.getElementById('btn-save-drive'),
    btnResetForm: document.getElementById('btn-reset-form'),

    inputJournalSearch: document.getElementById('input-journal-search'),
    btnRefreshJournal: document.getElementById('btn-refresh-journal'),
    journalTbody: document.getElementById('journal-tbody'),
    journalEmptyState: document.getElementById('journal-empty-state'),

    driveModalBackdrop: document.getElementById('drive-modal-backdrop'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    modalContractNumber: document.getElementById('modal-contract-number'),
    modalFileName: document.getElementById('modal-file-name'),
    modalTotalAmount: document.getElementById('modal-total-amount'),
    modalDriveBox: document.getElementById('modal-drive-box'),
    modalDriveLink: document.getElementById('modal-drive-link'),
    btnModalDownloadDocx: document.getElementById('btn-modal-download-docx'),
    btnModalCreateAnother: document.getElementById('btn-modal-create-another'),

    toastContainer: document.getElementById('toast-container'),
    mobileStickyBar: document.getElementById('mobile-sticky-bar'),
    mobileBarLabel: document.getElementById('mobile-bar-label'),
    mobileBarAmount: document.getElementById('mobile-bar-amount'),
    btnMobileDownload: document.getElementById('btn-mobile-download'),
    btnMobileSave: document.getElementById('btn-mobile-save'),
  };

  let lastSavedContractId = null;

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', () => {
    initDate();
    bindEvents();
    renderItemsTable();
    updateSummary();
    checkServerStatus();
    loadJournal();
  });

  function initDate() {
    const today = new Date().toISOString().slice(0, 10);
    el.inputDate.value = today;
    state.buyer.date = today;
    updateContractNumberTag();
  }

  function updateContractNumberTag() {
    const d = new Date(state.buyer.date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    el.labelContractNumber.textContent = `01-${day}${month}${year}-Р`;
  }

  // --- EVENT BINDINGS ---
  function bindEvents() {
    el.btnTabCreate.addEventListener('click', () => switchTab('create'));
    el.btnTabJournal.addEventListener('click', () => switchTab('journal'));

    el.inputFio.addEventListener('input', (e) => {
      state.buyer.fio = e.target.value;
      updateSummary();
    });

    el.inputFio.addEventListener('blur', (e) => {
      const formatted = capitalizeFio(e.target.value);
      if (formatted) {
        e.target.value = formatted;
        state.buyer.fio = formatted;
        updateSummary();
      }
    });

    el.btnClearFio.addEventListener('click', () => {
      el.inputFio.value = '';
      state.buyer.fio = '';
      updateSummary();
      el.inputFio.focus();
    });

    el.inputPhone.addEventListener('input', handlePhoneInput);

    el.inputDate.addEventListener('change', (e) => {
      state.buyer.date = e.target.value || new Date().toISOString().slice(0, 10);
      updateContractNumberTag();
      updateSummary();
    });

    el.inputAddress.addEventListener('input', (e) => {
      state.buyer.address = e.target.value;
    });

    el.chipMinsk.addEventListener('click', () => {
      if (!el.inputAddress.value.includes('г. Минск')) {
        el.inputAddress.value = el.inputAddress.value ? 'г. Минск, ' + el.inputAddress.value : 'г. Минск, ';
        state.buyer.address = el.inputAddress.value;
        el.inputAddress.focus();
      }
    });

    el.chipHouse.addEventListener('click', () => {
      if (!el.inputAddress.value.toLowerCase().includes('частный дом')) {
        el.inputAddress.value = el.inputAddress.value ? el.inputAddress.value + ', частный дом' : 'частный дом';
        state.buyer.address = el.inputAddress.value;
        el.inputAddress.focus();
      }
    });

    el.btnAddItem.addEventListener('click', () => {
      state.items.push({
        id: generateId(),
        name: '',
        quantity: 1,
        price: 0,
        warranty: 12,
      });
      renderItemsTable();
      updateSummary();
    });

    el.quickItemsBar.addEventListener('click', (e) => {
      const chip = e.target.closest('.item-preset-chip');
      if (chip) {
        const name = chip.dataset.name;
        const price = parseFloat(chip.dataset.price) || 0;
        const warranty = parseInt(chip.dataset.warranty, 10) || 12;

        state.items.push({
          id: generateId(),
          name,
          quantity: 1,
          price,
          warranty,
        });
        renderItemsTable();
        updateSummary();
        showToast(`Добавлен: ${name}`, 'info');
      }
    });

    el.btnDownloadDocx.addEventListener('click', handleDownloadDocx);
    if (el.btnMobileDownload) {
      el.btnMobileDownload.addEventListener('click', handleDownloadDocx);
    }
    if (el.btnMobileSave) {
      el.btnMobileSave.addEventListener('click', handleSaveAndDrive);
    }
    el.btnSaveDrive.addEventListener('click', handleSaveAndDrive);
    el.btnResetForm.addEventListener('click', resetForm);

    el.btnRefreshJournal.addEventListener('click', loadJournal);
    el.inputJournalSearch.addEventListener('input', debounce(loadJournal, 300));

    el.btnCloseModal.addEventListener('click', closeModal);
    el.driveModalBackdrop.addEventListener('click', (e) => {
      if (e.target === el.driveModalBackdrop) closeModal();
    });
    el.btnModalCreateAnother.addEventListener('click', () => {
      closeModal();
      resetForm();
      switchTab('create');
    });
    el.btnModalDownloadDocx.addEventListener('click', () => {
      if (lastSavedContractId) {
        downloadSavedContract(lastSavedContractId);
      }
    });
  }

  // --- TABS ---
  function switchTab(tab) {
    if (tab === 'create') {
      el.btnTabCreate.classList.add('active');
      el.btnTabCreate.setAttribute('aria-selected', 'true');
      el.btnTabJournal.classList.remove('active');
      el.btnTabJournal.setAttribute('aria-selected', 'false');
      el.tabCreate.classList.add('active');
      el.tabJournal.classList.remove('active');
      if (el.mobileStickyBar) el.mobileStickyBar.classList.remove('hidden');
    } else {
      el.btnTabJournal.classList.add('active');
      el.btnTabJournal.setAttribute('aria-selected', 'true');
      el.btnTabCreate.classList.remove('active');
      el.btnTabCreate.setAttribute('aria-selected', 'false');
      el.tabJournal.classList.add('active');
      el.tabCreate.classList.remove('active');
      if (el.mobileStickyBar) el.mobileStickyBar.classList.add('hidden');
      loadJournal();
    }
  }

  // --- SMART PHONE FORMATTER (BELARUS) ---
  function formatBelarusPhone(raw) {
    let digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';

    // Handle 8029... -> 37529...
    if (digits.startsWith('80')) {
      digits = '375' + digits.slice(2);
    } else if (digits.length >= 2 && ['25', '29', '33', '44', '17'].includes(digits.slice(0, 2))) {
      digits = '375' + digits;
    } else if (digits === '8') {
      digits = '375';
    }

    if (digits === '3') return '+3';
    if (digits === '37') return '+37';
    if (digits === '375') return '+375';

    if (!digits.startsWith('375')) {
      digits = '375' + digits;
    }

    digits = digits.slice(0, 12);

    let res = '+375';
    if (digits.length > 3) {
      res += ' (' + digits.slice(3, 5);
      if (digits.length >= 5) {
        res += ') ';
      }
    }
    if (digits.length > 5) {
      res += digits.slice(5, 8);
    }
    if (digits.length > 8) {
      res += '-' + digits.slice(8, 10);
    }
    if (digits.length > 10) {
      res += '-' + digits.slice(10, 12);
    }
    return res;
  }

  function handlePhoneInput(e) {
    const input = e.target;
    const formatted = formatBelarusPhone(input.value);
    input.value = formatted;
    state.buyer.phone = formatted;
  }

  function capitalizeFio(str) {
    if (!str) return '';
    return str
      .trim()
      .split(/\s+/)
      .map((part) => {
        if (!part) return '';
        if (part.includes('-')) {
          return part
            .split('-')
            .map((s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : ''))
            .join('-');
        }
        return part[0].toUpperCase() + part.slice(1).toLowerCase();
      })
      .join(' ');
  }

  // --- ITEMS TABLE RENDERING ---
  function renderItemsTable() {
    el.itemsTbody.innerHTML = '';

    state.items.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.dataset.id = item.id;

      const subtotal = item.quantity * item.price;
      const warranties = [12, 24, 36, 60, 84];
      const isCustomWarranty = !warranties.includes(item.warranty);

      tr.innerHTML = `
        <td class="col-num" data-label="№">${index + 1}</td>
        <td class="col-name" data-label="Наименование">
          <input 
            type="text" 
            class="table-input item-name-input" 
            placeholder="Наименование оборудования / услуги" 
            value="${escapeHtml(item.name)}" 
            data-field="name"
          >
        </td>
        <td class="col-qty" data-label="Количество">
          <div class="qty-control">
            <button type="button" class="qty-btn btn-qty-minus" data-action="minus" aria-label="Уменьшить">−</button>
            <input 
              type="number" 
              class="qty-input" 
              value="${item.quantity}" 
              min="1" 
              max="99" 
              inputmode="numeric"
              data-field="quantity"
            >
            <button type="button" class="qty-btn btn-qty-plus" data-action="plus" aria-label="Увеличить">+</button>
          </div>
        </td>
        <td class="col-price" data-label="Цена (BYN)">
          <div class="price-input-wrapper">
            <input 
              type="text" 
              class="table-input item-price-input" 
              inputmode="decimal"
              value="${item.price > 0 ? item.price.toFixed(2) : ''}" 
              placeholder="0.00"
              autocomplete="off"
              data-field="price"
            >
            <span class="price-currency-suffix">BYN</span>
          </div>
        </td>
        <td class="col-warranty" data-label="Гарантия">
          <div class="warranty-picker">
            ${warranties
              .map(
                (w) => `
              <button 
                type="button" 
                class="warranty-btn ${item.warranty === w ? 'active' : ''}" 
                data-months="${w}"
              >${w} мес.</button>
            `
              )
              .join('')}
            <input 
              type="number" 
              class="warranty-custom-input ${isCustomWarranty ? 'active' : ''}" 
              placeholder="Свой" 
              inputmode="numeric"
              value="${isCustomWarranty ? item.warranty : ''}" 
              title="Произвольный срок гарантии в месяцах"
            >
          </div>
        </td>
        <td class="col-subtotal" data-label="Сумма">
          <span class="subtotal-val">${formatMoney(subtotal)} BYN</span>
        </td>
        <td class="col-actions" data-label="">
          <button type="button" class="btn-remove-row" title="Удалить позицию" aria-label="Удалить">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      `;

      const nameInput = tr.querySelector('.item-name-input');
      nameInput.addEventListener('input', (e) => {
        item.name = e.target.value;
      });

      const qtyInput = tr.querySelector('.qty-input');
      qtyInput.addEventListener('change', (e) => {
        item.quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
        e.target.value = item.quantity;
        updateRowSubtotal(tr, item);
        updateSummary();
      });

      tr.querySelector('.btn-qty-minus').addEventListener('click', () => {
        if (item.quantity > 1) {
          item.quantity -= 1;
          qtyInput.value = item.quantity;
          updateRowSubtotal(tr, item);
          updateSummary();
        }
      });

      tr.querySelector('.btn-qty-plus').addEventListener('click', () => {
        item.quantity += 1;
        qtyInput.value = item.quantity;
        updateRowSubtotal(tr, item);
        updateSummary();
      });

      const priceInput = tr.querySelector('.item-price-input');
      priceInput.addEventListener('focus', (e) => {
        e.target.select();
      });
      priceInput.addEventListener('input', (e) => {
        const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
        const parsed = parseFloat(raw);
        item.price = isNaN(parsed) || parsed < 0 ? 0 : parsed;
        updateRowSubtotal(tr, item);
        updateSummary();
      });
      priceInput.addEventListener('blur', (e) => {
        if (item.price > 0) {
          e.target.value = item.price.toFixed(2);
        } else {
          e.target.value = '';
        }
      });

      tr.querySelectorAll('.warranty-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          item.warranty = parseInt(btn.dataset.months, 10);
          tr.querySelectorAll('.warranty-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const customInp = tr.querySelector('.warranty-custom-input');
          if (customInp) {
            customInp.value = '';
            customInp.classList.remove('active');
          }
        });
      });

      const customWarrantyInput = tr.querySelector('.warranty-custom-input');
      customWarrantyInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (val && val > 0) {
          item.warranty = val;
          tr.querySelectorAll('.warranty-btn').forEach((b) => b.classList.remove('active'));
          customWarrantyInput.classList.add('active');
        }
      });

      tr.querySelector('.btn-remove-row').addEventListener('click', () => {
        if (state.items.length <= 1) {
          showToast('Договор должен содержать хотя бы один товар', 'error');
          return;
        }
        state.items = state.items.filter((it) => it.id !== item.id);
        renderItemsTable();
        updateSummary();
      });

      el.itemsTbody.appendChild(tr);
    });
  }

  function updateRowSubtotal(tr, item) {
    const subtotal = item.quantity * item.price;
    const subtotalEl = tr.querySelector('.subtotal-val');
    if (subtotalEl) {
      subtotalEl.textContent = formatMoney(subtotal);
    }
  }

  // --- SUMMARY & NUMBERS ---
  function updateSummary() {
    const totalAmount = state.items.reduce((sum, it) => sum + it.quantity * it.price, 0);
    const totalPieces = state.items.reduce((sum, it) => sum + it.quantity, 0);
    const itemsCount = state.items.length;

    el.totalAmountDisplay.textContent = formatMoney(totalAmount);
    el.labelPreviewFio.textContent = (el.inputFio.value || state.buyer.fio || '').trim() || '—';
    el.labelItemsStats.textContent = `${itemsCount} ${pluralize(itemsCount, 'позиция', 'позиции', 'позиций')} (${totalPieces} шт.)`;

    const words = moneyInWordsRu(totalAmount);
    el.totalWordsDisplay.textContent = words;

    if (el.mobileBarAmount) {
      el.mobileBarAmount.textContent = formatMoney(totalAmount);
    }
    if (el.mobileBarLabel) {
      el.mobileBarLabel.textContent = `Итого (${totalPieces} шт.):`;
    }
  }

  // --- VALIDATION ---
  function validateForm() {
    const rawFio = (el.inputFio.value || state.buyer.fio || '').trim();
    state.buyer.fio = capitalizeFio(rawFio);
    if (state.buyer.fio) {
      el.inputFio.value = state.buyer.fio;
    }

    const fioParts = state.buyer.fio.split(/\s+/).filter(Boolean);
    if (fioParts.length < 2) {
      showToast('Пожалуйста, укажите как минимум Фамилию и Имя покупателя', 'error');
      el.inputFio.focus();
      return false;
    }

    state.buyer.phone = (el.inputPhone.value || state.buyer.phone || '').trim();
    const phoneDigits = state.buyer.phone.replace(/\D/g, '');
    if (phoneDigits.length < 9) {
      showToast('Введите корректный номер телефона (например, +375 29 123-45-67)', 'error');
      el.inputPhone.focus();
      return false;
    }

    state.buyer.address = (el.inputAddress.value || state.buyer.address || '').trim();
    if (!state.buyer.address) {
      showToast('Укажите адрес доставки или монтажа', 'error');
      el.inputAddress.focus();
      return false;
    }

    for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i];
      if (!item.name || !item.name.trim()) {
        showToast(`Укажите наименование товара в строке №${i + 1}`, 'error');
        return false;
      }
      if (item.quantity <= 0) {
        showToast(`Количество в строке №${i + 1} должно быть больше 0`, 'error');
        return false;
      }
    }

    return true;
  }

  function getPayload() {
    const cleanFio = (el.inputFio.value || state.buyer.fio || '').trim();
    const cleanPhone = (el.inputPhone.value || state.buyer.phone || '').trim();
    const cleanAddress = (el.inputAddress.value || state.buyer.address || '').trim();

    return {
      buyer_fio: cleanFio,
      phone: cleanPhone,
      address: cleanAddress,
      contract_date: state.buyer.date,
      items: state.items.map((it) => ({
        name: it.name.trim(),
        quantity: parseInt(it.quantity, 10),
        unit_price_cents: Math.round(it.price * 100),
        warranty_months: parseInt(it.warranty, 10) || 12,
      })),
    };
  }

  // --- ACTIONS: DOWNLOAD DOCX ---
  async function handleDownloadDocx() {
    if (!validateForm()) return;

    setButtonLoading(el.btnDownloadDocx, true, 'Формирую Word...');
    try {
      const payload = getPayload();
      const response = await fetch('/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Не удалось сформировать документ');
      }

      let filename = 'Договор.docx';
      const disposition = response.headers.get('Content-Disposition');
      if (disposition && disposition.includes("filename*=UTF-8''")) {
        filename = decodeURIComponent(disposition.split("filename*=UTF-8''")[1]);
      } else if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename=')[1].replace(/["']/g, '');
      }

      const blob = await response.blob();
      triggerBlobDownload(blob, filename);
      showToast(`Документ «${filename}» успешно скачан`, 'success');
      loadJournal();
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(el.btnDownloadDocx, false);
    }
  }

  // --- ACTIONS: SAVE TO DB & GOOGLE DRIVE ---
  async function handleSaveAndDrive() {
    if (!validateForm()) return;

    setButtonLoading(el.btnSaveDrive, true, 'Сохраняю и загружаю...');
    try {
      const payload = getPayload();
      const response = await fetch('/contracts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Ошибка сохранения договора');
      }

      const data = await response.json();
      lastSavedContractId = data.contract_id;

      el.modalContractNumber.textContent = data.contract_number;
      el.modalFileName.textContent = data.filename;
      el.modalTotalAmount.textContent = `${data.total_formatted} BYN`;

      if (data.drive_link) {
        el.modalDriveBox.classList.remove('hidden');
        el.modalDriveLink.href = data.drive_link;
      } else {
        el.modalDriveBox.classList.add('hidden');
      }

      el.driveModalBackdrop.classList.remove('hidden');
      showToast(`Договор ${data.contract_number} успешно сохранён!`, 'success');
      loadJournal();
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(el.btnSaveDrive, false);
    }
  }

  function downloadSavedContract(contractId) {
    window.location.href = `/contracts/${contractId}/download`;
  }

  function triggerBlobDownload(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }

  function closeModal() {
    el.driveModalBackdrop.classList.add('hidden');
  }

  function resetForm() {
    state.buyer.fio = '';
    state.buyer.phone = '';
    state.buyer.address = '';
    initDate();

    el.inputFio.value = '';
    el.inputPhone.value = '';
    el.inputAddress.value = '';

    state.items = [
      {
        id: generateId(),
        name: 'Кондиционер Daikin Emura 3 FTXJ20AW/RXJ20A',
        quantity: 1,
        price: 13706.50,
        warranty: 60,
      },
    ];
    renderItemsTable();
    updateSummary();
    showToast('Форма очищена', 'info');
  }

  // --- JOURNAL ---
  async function loadJournal() {
    try {
      const search = (el.inputJournalSearch.value || '').trim();
      const url = search ? `/contracts?search=${encodeURIComponent(search)}` : '/contracts';
      const res = await fetch(url);
      if (!res.ok) return;

      const contracts = await res.json();
      el.journalCountBadge.textContent = contracts.length;
      renderJournalTable(contracts);
    } catch (err) {
      console.error('Journal load error:', err);
    }
  }

  function renderJournalTable(contracts) {
    el.journalTbody.innerHTML = '';

    if (!contracts || contracts.length === 0) {
      el.journalEmptyState.classList.remove('hidden');
      return;
    }

    el.journalEmptyState.classList.add('hidden');

    contracts.forEach((c) => {
      const tr = document.createElement('tr');
      const items = Array.isArray(c.items) ? c.items : [];
      const itemsSummary = items.map((it) => `${it.name} (${it.quantity} шт.)`).join(', ');

      tr.innerHTML = `
        <td data-label="Номер"><strong class="contract-num-badge">${escapeHtml(c.contract_number)}</strong></td>
        <td data-label="Дата">${escapeHtml(c.contract_date)}</td>
        <td data-label="Покупатель"><strong>${escapeHtml(c.buyer_fio)}</strong></td>
        <td data-label="Телефон"><a href="tel:${escapeHtml(c.phone)}" class="journal-phone-link">${escapeHtml(c.phone)}</a></td>
        <td data-label="Товары" title="${escapeHtml(itemsSummary)}" class="journal-items-cell">
          ${escapeHtml(itemsSummary)}
        </td>
        <td data-label="Сумма"><strong class="journal-sum-badge">${formatMoney(c.total_amount_cents / 100)} BYN</strong></td>
        <td data-label="Действия" class="journal-actions-col">
          <div class="action-btns-cell">
            <button class="btn btn-secondary btn-sm btn-table-download" data-id="${c.id}" title="Скачать .docx">
              <svg class="btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Скачать
            </button>
            ${
              c.drive_link
                ? `<a href="${c.drive_link}" target="_blank" class="btn btn-drive btn-sm" title="Google Drive">Drive</a>`
                : ''
            }
          </div>
        </td>
      `;

      tr.querySelector('.btn-table-download').addEventListener('click', () => {
        downloadSavedContract(c.id);
      });

      el.journalTbody.appendChild(tr);
    });
  }

  // --- STATUS CHECK ---
  async function checkServerStatus() {
    try {
      const res = await fetch('/status');
      if (res.ok) {
        const data = await res.json();
        state.systemStatus = data;
        el.statusDot.className = 'status-dot online';
        if (data.google_drive_configured) {
          el.statusLabel.textContent = 'Сервер и Drive подключены';
        } else {
          el.statusLabel.textContent = 'Сервер готов';
        }
      }
    } catch (e) {
      el.statusDot.className = 'status-dot';
      el.statusDot.style.background = '#f59e0b';
      el.statusLabel.textContent = 'Автономный режим';
    }
  }

  // --- UI HELPERS ---
  function setButtonLoading(btn, isLoading, loadingText = 'Обработка...') {
    if (isLoading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="pulsing-circle"></span> ${loadingText}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
      }
    }
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function formatMoney(amount) {
    return Number(amount).toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function pluralize(n, one, two, five) {
    let num = Math.abs(n) % 100;
    let n1 = num % 10;
    if (num > 10 && num < 20) return five;
    if (n1 > 1 && n1 < 5) return two;
    if (n1 === 1) return one;
    return five;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // --- BELARUSIAN RUBLES WORDS TRANSLATION ---
  function moneyInWordsRu(amount) {
    const totalCents = Math.round(amount * 100);
    const rubles = Math.floor(totalCents / 100);
    const kopecks = totalCents % 100;

    const rublesWords = integerToWords(rubles, true);
    const rublesUnit = pluralize(rubles, 'белорусский рубль', 'белорусских рубля', 'белорусских рублей');
    const kopecksStr = String(kopecks).padStart(2, '0');
    const kopecksUnit = pluralize(kopecks, 'копейка', 'копейки', 'копеек');

    const result = `${rublesWords} ${rublesUnit} ${kopecksStr} ${kopecksUnit}`;
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  function integerToWords(number, isMale = true) {
    if (number === 0) return 'ноль';

    const onesM = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const onesF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

    function triplet(num, male) {
      const h = Math.floor(num / 100);
      const rem = num % 100;
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      const parts = [];

      if (h > 0) parts.push(hundreds[h]);
      if (t === 1) {
        parts.push(teens[o]);
      } else {
        if (t > 1) parts.push(tens[t]);
        if (o > 0) parts.push(male ? onesM[o] : onesF[o]);
      }
      return parts.join(' ');
    }

    const billions = Math.floor(number / 1_000_000_000) % 1_000;
    const millions = Math.floor(number / 1_000_000) % 1_000;
    const thousands = Math.floor(number / 1_000) % 1_000;
    const units = number % 1_000;

    const parts = [];
    if (billions > 0) {
      parts.push(triplet(billions, true) + ' ' + pluralize(billions, 'миллиард', 'миллиарда', 'миллиардов'));
    }
    if (millions > 0) {
      parts.push(triplet(millions, true) + ' ' + pluralize(millions, 'миллион', 'миллиона', 'миллионов'));
    }
    if (thousands > 0) {
      parts.push(triplet(thousands, false) + ' ' + pluralize(thousands, 'тысяча', 'тысячи', 'тысяч'));
    }
    if (units > 0) {
      parts.push(triplet(units, isMale));
    }

    return parts.filter(Boolean).join(' ');
  }
})();
