// Shared by the Dunhuang Within and Chronica Maps partner pages.
(() => {
  'use strict';
  const script = document.currentScript;
  const isChronica = script.dataset.site === 'chronica';
  const partnerDomain = isChronica ? 'dunhuangwithin.com' : 'chronicamaps.com';
  const outbound = isChronica ? 'chronica_to_dunhuang' : 'dunhuang_to_chronica';
  const inbound = isChronica ? 'dunhuang_to_chronica' : 'chronica_to_dunhuang';
  const cmLinks = ['cm-stops-trail', 'cm-city-guides', 'cm-mogao-cave', 'cm-panel-stops-trail', 'cm-panel-city-yumen', 'cm-panel-mogao-cave'];
  const dwLinks = ['dw-crossroads-atlas', 'dw-crossroads-stops', 'dw-trail-city', 'dw-cave-mogao'];
  const incomingIds = isChronica ? dwLinks : cmLinks;
  const outgoingIds = isChronica ? cmLinks : dwLinks;
  const parameter = 'atlas_link';
  const isPartner = url => url.protocol === 'https:' && [partnerDomain, 'www.' + partnerDomain].includes(url.hostname);

  // This short code identifies a published link, never a visitor. Leave the share URL clean.
  const current = new URL(location.href);
  const sourceId = current.searchParams.get(parameter);
  const partnerReferrer = document.referrer && isPartner(new URL(document.referrer));
  let arrival = incomingIds.includes(sourceId) ? sourceId : null;
  if (!arrival && partnerReferrer && performance.getEntriesByType('navigation')[0]?.type === 'navigate') {
    arrival = 'unassigned';
  }
  if (current.searchParams.has(parameter)) {
    current.searchParams.delete(parameter);
    history.replaceState(history.state, '', current);
  }

  const measurementId = /^G-[A-Z0-9]+$/.test(script.dataset.ga || '') ? script.dataset.ga : '';
  window.dataLayer = window.dataLayer || [];
  if (measurementId) {
    const existingTag = typeof window.gtag === 'function';
    if (!existingTag) window.gtag = function () { window.dataLayer.push(arguments); };
    if (!window.google_tag_manager?.[measurementId] && !document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
      const tag = document.createElement('script');
      tag.async = true;
      tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
      document.head.append(tag);
      window.gtag('js', new Date());
    }
    window.gtag('config', measurementId, { send_page_view: false });
  }

  function emit(name, linkId, direction, action) {
    const fields = { link_id: linkId, direction };
    if (action) fields.action = action;
    if (measurementId) {
      window.gtag('event', name, { ...fields, send_to: measurementId });
    } else if (typeof window.gtag === 'function') {
      window.gtag('event', name, fields);
    } else {
      window.dataLayer.push({ event: name, ...fields });
    }
  }

  const selector = 'a[data-bridge-id][href]';
  function validLink(link) {
    return link && outgoingIds.includes(link.dataset.bridgeId) && isPartner(new URL(link.href));
  }

  // Observe panel replacements, not the many paths that redraw when the atlas moves.
  if ('IntersectionObserver' in window) {
    const seen = new Set();
    const visible = new Set();
    const flush = () => {
      if (document.visibilityState !== 'visible') return;
      for (const link of visible) {
        const id = link.dataset.bridgeId;
        if (link.isConnected && !seen.has(id)) {
          seen.add(id);
          emit('bridge_view', id, outbound);
        }
        observer.unobserve(link);
      }
      visible.clear();
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      flush();
    }, { threshold: 0.5 });
    const observeLinks = root => {
      for (const link of root.querySelectorAll(selector)) {
        if (validLink(link) && !seen.has(link.dataset.bridgeId)) observer.observe(link);
      }
    };
    document.addEventListener('visibilitychange', flush);
    observeLinks(document);
    const panel = document.querySelector('#pbody');
    if (panel) new MutationObserver(() => observeLinks(panel)).observe(panel, { childList: true, subtree: true });
  }

  function engage(action) {
    if (!arrival) return;
    emit('bridge_engage', arrival, inbound, action);
    arrival = null;
  }

  function handleClick(event) {
    if (!event.isTrusted || (event.type === 'auxclick' ? event.button !== 1 : event.button !== 0)) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('a[href]');
    if (validLink(link)) {
      // Keep native navigation, including keyboard, middle-click and Ctrl/Cmd-click.
      // Add attribution only during activation. HTML, copied links and the back page stay clean.
      const original = link.getAttribute('href');
      const destination = new URL(link.href);
      destination.searchParams.set(parameter, link.dataset.bridgeId);
      link.href = destination.href;
      setTimeout(() => {
        if (link.href === destination.href) link.setAttribute('href', original);
      }, 0);
      emit('bridge_click', link.dataset.bridgeId, outbound);
      return;
    }
    if (!arrival) return;
    if (target.closest('.map-marker:not([aria-pressed="true"]), .trail-tab[aria-pressed="false"], #pbody [data-rp], #pbody [data-city], #pbody [data-site], #pbody [data-lm], #map g.city, #map g.lm, #map g.site')) {
      engage('select_place');
    } else if (target.closest('#track, #bPrev, #bNext, #bPlay, #pbody [data-y]')) {
      engage('change_year');
    } else if (link && link.closest('main, #pbody') && link.origin === location.origin && link.pathname !== location.pathname) {
      engage('open_related_page');
    }
  }

  document.addEventListener('click', handleClick, true);
  document.addEventListener('auxclick', handleClick, true);
  document.addEventListener('change', e => {
    if (e.isTrusted && e.target.matches('.map-place-picker select')) engage('select_place');
  });
  document.addEventListener('keydown', e => {
    if (e.isTrusted && !e.repeat && ['ArrowLeft', 'ArrowRight'].includes(e.key) && document.querySelector('#timeline') &&
        !e.target.closest('input,select,textarea,[contenteditable]')) engage('change_year');
  });
})();
