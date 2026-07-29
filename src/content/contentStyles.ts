export const contentStyles = `
  :host { --maw-ink: #1e2925; --maw-muted: #66736d; --maw-pine: #29463d; --maw-pine-strong: #203a32; --maw-sage: #e3eae4; --maw-paper: #f3f4ef; --maw-surface: #fcfcf8; --maw-line: #d7ddd7; --maw-rust: #9a4e3f; --maw-focus: #c49355; all: initial; }
  *, *::before, *::after { box-sizing: border-box; }
  .maw-shell { position: fixed; inset: 0; pointer-events: none; font-family: Aptos, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif; color: var(--maw-ink); }
  .maw-effect-layer { position: fixed; z-index: 0; inset: 0; display: block; width: 100vw; height: 100vh; opacity: .88; pointer-events: none !important; contain: strict; }
  .maw-launcher { position: absolute; z-index: 5; bottom: 18px; width: 46px; height: 46px; border: 0; border-radius: 14px; padding: 0; background: transparent; color: white; box-shadow: none; cursor: pointer; pointer-events: auto; }
  .maw-launcher.right { right: 18px; } .maw-launcher.left { left: 18px; }
  .maw-launcher-mark { display: block; width: 100%; height: 100%; overflow: visible; filter: none; }
  .maw-launcher.pinning .maw-launcher-mark { filter: none; }
  .maw-quick-menu { position: absolute; z-index: 6; bottom: 74px; display: grid; gap: 12px; width: min(330px, calc(100vw - 32px)); max-height: min(620px, calc(100vh - 108px)); overflow: auto; border: 1px solid var(--maw-line); border-radius: 12px; padding: 15px; color: var(--maw-ink); background: var(--maw-surface); box-shadow: 0 16px 42px rgba(35,51,45,.16); pointer-events: auto; overscroll-behavior: contain; }
  .maw-quick-menu.right { right: 18px; } .maw-quick-menu.left { left: 18px; }
  .maw-quick-menu > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .maw-quick-menu > header strong { display: block; color: var(--maw-ink); font: 800 14px/1.25 Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-quick-menu > header p { margin: 4px 0 0; color: var(--maw-muted); font: 500 10px/1.45 Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-quick-menu > header button { display: grid; flex: none; width: 28px; height: 28px; place-items: center; border: 1px solid var(--maw-line); border-radius: 6px; padding: 0; color: var(--maw-muted); background: #f1f3ef; cursor: pointer; font: 700 16px/1 Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-quick-menu > header button .maw-quick-icon { width: 17px; height: 17px; }
  .maw-quick-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; }
  .maw-quick-actions > button:only-child { grid-column: 1 / -1; }
  .maw-quick-actions > button { display: grid; min-width: 0; min-height: 68px; place-items: center; gap: 5px; border: 1px solid var(--maw-line); border-radius: 8px; padding: 9px 6px; color: var(--maw-pine); background: #f6f7f3; cursor: pointer; font: 800 10px/1.3 Aptos, "Segoe UI Variable", system-ui, sans-serif; text-align: center; }
  .maw-quick-actions > button:hover { border-color: #9fb0a7; background: #eef2ed; }
  .maw-quick-actions > button[aria-pressed='true'] { border-color: var(--maw-rust); color: #fff; background: var(--maw-rust); }
  .maw-quick-icon { display: block; width: 20px; height: 20px; flex: none; }
  .maw-quick-actions > button > .maw-quick-icon { width: 21px; height: 21px; }
  .maw-quick-actions > button:disabled, .maw-quick-branch-picker button:disabled { cursor: wait; opacity: .55; }
  .maw-quick-prompts, .maw-quick-branch-picker { display: grid; gap: 8px; border-top: 1px solid var(--maw-line); padding-top: 11px; }
  .maw-quick-prompts .maw-list { max-height: 230px; }
  .maw-quick-branch-picker > strong { color: var(--maw-muted); font: 800 10px/1.3 Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-quick-branch-picker > div { display: grid; gap: 5px; max-height: 180px; overflow: auto; }
  .maw-quick-branch-picker button { border: 1px solid transparent; border-radius: 6px; padding: 8px 10px; color: var(--maw-pine); background: #f1f3ef; cursor: pointer; font: 700 10px/1.3 Aptos, "Segoe UI Variable", system-ui, sans-serif; text-align: left; }
  .maw-quick-branch-picker button:hover { border-color: var(--maw-line); background: var(--maw-sage); }
  .maw-quick-workspace { display: flex; align-items: center; justify-content: space-between; width: 100%; border: 1px solid var(--maw-line); border-radius: 7px; padding: 10px 12px; color: var(--maw-muted); background: #eef1ed; cursor: pointer; font: 800 10px/1.3 Aptos, "Segoe UI Variable", system-ui, sans-serif; text-align: left; }
  .maw-quick-workspace:hover { color: var(--maw-pine); background: var(--maw-sage); }
  .maw-quick-workspace .maw-quick-icon { width: 16px; height: 16px; }
  .maw-highlight-layer { position: absolute; z-index: 0; inset: 0; overflow: hidden; pointer-events: none; }
  .maw-highlight-rectangle { position: fixed; border-radius: 3px; box-shadow: inset 0 -1px 0 rgba(40,48,70,.14); mix-blend-mode: multiply; pointer-events: none; }
  .maw-prompt-navigator { position: absolute; z-index: 1; top: 15vh; right: 5px; width: 34px; height: 70vh; pointer-events: none; }
  .maw-prompt-card { position: absolute; top: 50%; right: 34px; display: grid; width: min(300px, calc(100vw - 92px)); max-height: min(360px, 62vh); overflow: hidden; visibility: hidden; border: 1px solid var(--maw-line); border-radius: 10px; padding: 10px; opacity: 0; background: var(--maw-surface); box-shadow: 0 14px 38px rgba(35,51,45,.16); transform: translateY(-50%) translateX(8px) scale(.98); transform-origin: right center; pointer-events: none; transition: opacity .16s ease, transform .16s ease, visibility 0s linear .16s; }
  .maw-prompt-navigator:hover .maw-prompt-card, .maw-prompt-navigator:focus-within .maw-prompt-card { visibility: visible; opacity: 1; transform: translateY(-50%) translateX(0) scale(1); pointer-events: auto; transition-delay: 0s; }
  .maw-prompt-card-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 2px 3px 8px; }
  .maw-prompt-card-heading strong { overflow: hidden; color: var(--maw-ink); font: 800 10px/1.25 Aptos, "Segoe UI Variable", system-ui, sans-serif; text-overflow: ellipsis; white-space: nowrap; }
  .maw-prompt-card-heading span { display: grid; flex: none; min-width: 20px; height: 20px; place-items: center; border-radius: 4px; color: var(--maw-muted); background: #edf0ec; font: 800 9px Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-prompt-list { display: grid; gap: 5px; min-height: 0; overflow: auto; overscroll-behavior: contain; }
  .maw-prompt-list button { display: grid; grid-template-columns: 22px minmax(0,1fr); align-items: center; gap: 7px; width: 100%; border: 1px solid transparent; border-radius: 6px; padding: 7px; color: var(--maw-muted); background: #f4f6f2; cursor: pointer; text-align: left; }
  .maw-prompt-list button > span { display: grid; width: 22px; height: 22px; place-items: center; border-radius: 4px; color: #fff; background: #70877c; font: 800 8px Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-prompt-list button p { display: -webkit-box; overflow: hidden; margin: 0; font: 600 9px/1.42 Aptos, "Segoe UI Variable", system-ui, sans-serif; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .maw-prompt-list button:hover { border-color: var(--maw-line); background: #eef2ed; }
  .maw-prompt-list button.active { color: var(--maw-pine); background: var(--maw-sage); box-shadow: inset 3px 0 var(--maw-pine); }
  .maw-prompt-list button.active > span { background: var(--maw-pine); }
  .maw-prompt-list button:focus-visible { outline: 3px solid var(--maw-focus); outline-offset: 2px; }
  .maw-message-rail { position: absolute; inset: 0; border-radius: 999px; pointer-events: auto; }
  .maw-message-rail-track { position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; border-radius: 999px; background: rgba(108,126,117,.32); transform: translateX(-50%); }
  .maw-message-jump { position: absolute; left: 50%; width: 8px; height: 8px; border: 0; border-radius: 999px; padding: 0; background: #70877c; box-shadow: 0 0 0 2px rgba(252,252,248,.92); cursor: pointer; opacity: .72; transform: translate(-50%,-50%); transition: width .14s ease, height .14s ease, opacity .14s ease, background .14s ease; }
  .maw-message-jump.user { background: #70877c; }
  .maw-message-jump.assistant { background: #29463d; }
  .maw-message-jump:hover, .maw-message-jump.active { width: 12px; height: 12px; opacity: 1; background: var(--maw-pine); }
  .maw-message-jump:focus-visible { width: 12px; height: 12px; outline: 3px solid var(--maw-focus); outline-offset: 2px; opacity: 1; }
  .maw-pin-navigator { position: absolute; z-index: 2; top: 15vh; right: 45px; width: 34px; height: 70vh; pointer-events: none; }
  .maw-pin-stepper { position: absolute; top: -38px; left: 50%; display: flex; align-items: center; gap: 2px; border: 1px solid rgba(117,76,57,.18); border-radius: 999px; padding: 3px; background: rgba(255,252,247,.96); box-shadow: 0 8px 22px rgba(62,39,30,.16); transform: translateX(-50%); pointer-events: auto; }
  .maw-pin-stepper button { display: grid; width: 22px; height: 22px; place-items: center; border: 0; border-radius: 50%; padding: 0; color: #8b4937; background: transparent; cursor: pointer; font: 800 12px/1 Inter, system-ui, sans-serif; }
  .maw-pin-stepper button:hover { background: #f8e5da; }
  .maw-pin-stepper > span { min-width: 18px; color: #784433; font: 800 9px/1 Inter, system-ui, sans-serif; text-align: center; }
  .maw-pin-card { position: absolute; top: 50%; right: 34px; display: grid; width: min(300px, calc(100vw - 138px)); max-height: min(360px, 62vh); overflow: hidden; visibility: hidden; border: 1px solid #dbc9c2; border-radius: 10px; padding: 10px; opacity: 0; background: #fffaf6; box-shadow: 0 14px 38px rgba(83,55,44,.16); transform: translateY(-50%) translateX(8px) scale(.98); transform-origin: right center; pointer-events: none; transition: opacity .16s ease, transform .16s ease, visibility 0s linear .16s; }
  .maw-pin-navigator:hover .maw-pin-card, .maw-pin-navigator:focus-within .maw-pin-card { visibility: visible; opacity: 1; transform: translateY(-50%) translateX(0) scale(1); pointer-events: auto; transition-delay: 0s; }
  .maw-pin-card-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 2px 3px 8px; }
  .maw-pin-card-heading strong { overflow: hidden; color: #5d352c; font: 800 10px/1.25 Inter, system-ui, sans-serif; text-overflow: ellipsis; white-space: nowrap; }
  .maw-pin-card-heading span { display: grid; flex: none; min-width: 20px; height: 20px; place-items: center; border-radius: 999px; color: #784433; background: #f5e8df; font: 800 9px Inter, system-ui, sans-serif; }
  .maw-pin-list { display: grid; gap: 5px; min-height: 0; overflow: auto; }
  .maw-pin-list > div { display: grid; grid-template-columns: minmax(0,1fr) 26px; align-items: stretch; gap: 3px; border-radius: 10px; background: #f8f1ec; }
  .maw-pin-list > div.active { background: #f3e2d7; box-shadow: inset 3px 0 #c96047; }
  .maw-pin-list-jump { display: grid; grid-template-columns: 22px minmax(0,1fr); align-items: center; gap: 7px; min-width: 0; border: 0; border-radius: 10px; padding: 6px 5px 6px 7px; color: #563a34; background: transparent; cursor: pointer; text-align: left; }
  .maw-pin-list-jump > span { display: grid; width: 22px; height: 22px; place-items: center; border-radius: 7px; color: #fff; background: #c96047; font: 800 8px Inter, system-ui, sans-serif; }
  .maw-pin-list-jump p { display: -webkit-box; overflow: hidden; margin: 0; font: 600 9px/1.42 Inter, system-ui, sans-serif; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .maw-pin-remove { border: 0; border-radius: 8px; padding: 0; color: #9a695c; background: transparent; cursor: pointer; font: 800 15px/1 Inter, system-ui, sans-serif; }
  .maw-pin-remove:hover { color: #fff; background: #b94f43; }
  .maw-pin-rail { position: absolute; inset: 0; border-radius: 999px; pointer-events: auto; }
  .maw-pin-rail-track { position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; border-radius: 999px; background: rgba(167,119,95,.28); transform: translateX(-50%); }
  .maw-pin-jump { position: absolute; left: 50%; width: 10px; height: 10px; border: 2px solid rgba(255,255,255,.94); border-radius: 3px; padding: 0; background: #c96047; box-shadow: 0 1px 4px rgba(83,42,32,.34); cursor: pointer; opacity: .78; transform: translate(-50%,-50%) rotate(45deg); transition: width .14s ease, height .14s ease, opacity .14s ease, background .14s ease; }
  .maw-pin-jump:hover, .maw-pin-jump.active { width: 14px; height: 14px; opacity: 1; background: #9f3f35; }
  .maw-pin-jump:focus-visible, .maw-pin-stepper button:focus-visible, .maw-pin-list-jump:focus-visible, .maw-pin-remove:focus-visible { outline: 3px solid #f2b84b; outline-offset: 2px; }
  .maw-pin-mode-hint { position: absolute; z-index: 6; bottom: 24px; left: 50%; max-width: min(360px, calc(100vw - 140px)); border-radius: 11px; padding: 8px 10px; color: #5d352c; background: rgba(255,252,247,.97); box-shadow: 0 8px 24px rgba(55,33,26,.16); pointer-events: none; font: 700 10px/1.45 Inter, system-ui, sans-serif; text-align: center; transform: translateX(-50%); }
  .maw-pin-notice button:focus-visible { outline: 3px solid #f2b84b; outline-offset: 2px; }
  .maw-pin-target-preview { position: fixed; z-index: 4; border: 3px solid #fff; border-radius: 999px; background: #c55242; box-shadow: 0 0 0 2px #c55242, 0 8px 24px rgba(115,52,40,.28); pointer-events: none; transform: translateZ(0); }
  .maw-pin-notice { position: absolute; z-index: 6; right: 18px; bottom: 78px; display: flex; align-items: center; gap: 8px; max-width: min(360px, calc(100vw - 36px)); border: 1px solid rgba(117,76,57,.2); border-radius: 13px; padding: 9px 10px 9px 12px; color: #6f3e31; background: rgba(255,249,242,.98); box-shadow: 0 12px 34px rgba(55,33,26,.22); pointer-events: auto; font: 700 10px/1.4 Inter, system-ui, sans-serif; }
  .maw-pin-notice.success { color: #2e6847; background: rgba(240,250,244,.98); }
  .maw-pin-notice > span { min-width: 0; }
  .maw-pin-notice button { flex: none; border: 0; border-radius: 8px; padding: 6px 8px; color: #8b4937; background: #f5e3d8; cursor: pointer; font: 800 10px/1 Inter, system-ui, sans-serif; }
  .maw-pin-notice.success button { color: #2e6847; background: #dcefe4; }
  .maw-pin-notice .maw-pin-notice-dismiss { width: 24px; height: 24px; padding: 0; color: #7b685f; background: transparent; font-size: 15px; }
  .maw-selection-popover { position: absolute; z-index: 3; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 7px; width: min(560px, calc(100vw - 24px)); border: 1px solid var(--maw-line); border-radius: 8px; padding: 7px; color: var(--maw-ink); background: var(--maw-surface); box-shadow: 0 12px 32px rgba(35,51,45,.18); pointer-events: auto; }
  .maw-selection-popover.above { transform: translate(-50%, -100%); }
  .maw-selection-popover.below { transform: translate(-50%, 0); }
  .maw-selection-preview { overflow: hidden; padding-left: 4px; color: var(--maw-muted); font: 500 9px/1.35 Aptos, "Segoe UI Variable", system-ui, sans-serif; text-overflow: ellipsis; white-space: nowrap; }
  .maw-selection-actions { display: inline-flex; align-items: center; gap: 5px; }
  .maw-selection-rewrite, .maw-selection-quote, .maw-selection-highlight, .maw-selection-pin { display: inline-flex; align-items: center; gap: 5px; min-height: 30px; border: 1px solid transparent; border-radius: 6px; padding: 6px 9px; cursor: pointer; font: 800 9px Aptos, "Segoe UI Variable", system-ui, sans-serif; white-space: nowrap; }
  .maw-selection-rewrite { color: #fff; background: var(--maw-pine); }
  .maw-selection-quote { color: var(--maw-pine); background: var(--maw-sage); }
  .maw-selection-pin { color: #8b4937; background: #f9e9df; }
  .maw-selection-pin.active { color: #fff; background: #b95042; }
  .maw-selection-highlight { color: #62501b; background: #fff4bd; }
  .maw-selection-highlight-remove { color: #8b3540; background: #fdecef; }
  .maw-highlight-actions { display: inline-flex; align-items: center; gap: 4px; }
  .maw-highlight-palette { display: inline-flex; align-items: center; gap: 3px; }
  .maw-highlight-palette button { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.96); border-radius: 50%; padding: 0; box-shadow: 0 0 0 1px rgba(71,79,105,.25); cursor: pointer; }
  .maw-highlight-palette button[aria-pressed='true'] { box-shadow: 0 0 0 2px var(--maw-pine); transform: scale(1.08); }
  .maw-selection-rewrite span { color: #fff1a8; font-size: 12px; }
  .maw-selection-highlight > span { font-size: 13px; }
  .maw-selection-dismiss { width: 26px; height: 26px; border: 1px solid var(--maw-line); border-radius: 5px; padding: 0; color: var(--maw-muted); background: #f1f3ef; cursor: pointer; font: 700 15px/1 Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-selection-error { grid-column: 1 / -1; color: var(--maw-rust); font: 700 9px/1.4 Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-selection-rewrite:focus-visible, .maw-selection-quote:focus-visible, .maw-selection-highlight:focus-visible, .maw-selection-pin:focus-visible, .maw-highlight-palette button:focus-visible, .maw-selection-dismiss:focus-visible { outline: 3px solid var(--maw-focus); outline-offset: 2px; }
  .maw-launcher:focus-visible, .maw-close:focus-visible, .maw-quick-menu button:focus-visible { outline: 3px solid var(--maw-focus); outline-offset: 3px; }
  .maw-panel { position: absolute; z-index: 4; bottom: 74px; width: min(420px, calc(100vw - 32px)); max-height: min(720px, calc(100vh - 110px)); overflow: auto; padding: 20px; border: 1px solid var(--maw-line); border-radius: 12px; background: var(--maw-surface); box-shadow: 0 18px 48px rgba(35,51,45,.18); pointer-events: auto; }
  .maw-panel.right { right: 18px; } .maw-panel.left { left: 18px; }
  .maw-panel.compact { width: min(360px, calc(100vw - 32px)); }
  .maw-panel.standard { width: min(420px, calc(100vw - 32px)); }
  .maw-panel.wide { width: min(520px, calc(100vw - 32px)); }
  .maw-eyebrow { margin: 0 0 7px; color: var(--maw-pine); font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .maw-title { margin: 0; color: var(--maw-ink); font-size: 20px; line-height: 1.2; }
  .maw-description { margin: 10px 0 14px; color: var(--maw-muted); font-size: 13px; line-height: 1.55; }
  .maw-status { display: flex; gap: 9px; align-items: center; padding: 10px 12px; border: 1px solid #cfd9d1; border-radius: 7px; background: #ebf0eb; color: var(--maw-pine); font-size: 12px; font-weight: 700; }
  .maw-dot { width: 8px; height: 8px; border-radius: 50%; background: #e1a52b; box-shadow: 0 0 0 4px rgba(225,165,43,.15); }
  .maw-close { position: absolute; top: 13px; right: 13px; width: 30px; height: 30px; border: 1px solid var(--maw-line); border-radius: 6px; background: #f0f2ee; color: var(--maw-muted); cursor: pointer; }
  .language-toggle { display: inline-flex; gap: 2px; margin: 0 0 12px; padding: 3px; border: 1px solid var(--maw-line); border-radius: 7px; background: #edf0eb; pointer-events: auto; }
  .language-toggle button { border: 0; border-radius: 5px; padding: 5px 8px; color: var(--maw-muted); background: transparent; cursor: pointer; font: 800 10px Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .language-toggle button.active { color: #fff; background: var(--maw-pine); }
  .maw-compatibility { display: grid; gap: 9px; margin-bottom: 12px; border: 1px solid #dfe3ee; border-radius: 13px; padding: 11px; background: #fff; }
  .maw-compatibility > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .maw-compatibility > header strong { display: block; color: #29334b; font-size: 11px; }
  .maw-compatibility > header p { margin: 3px 0 0; color: #747d90; font-size: 9px; line-height: 1.45; }
  .maw-monitor-status { flex: none; border-radius: 999px; padding: 4px 7px; color: #246344; background: #e8f7ee; font: 800 8px Inter, system-ui, sans-serif; }
  .maw-monitor-status.partial { color: #755515; background: #fff5d9; }
  .maw-monitor-status.degraded { color: #8f3039; background: #fff0f1; }
  .maw-monitor-status.recovering { color: var(--maw-pine); background: var(--maw-sage); }
  .maw-compatibility-list { display: grid; gap: 5px; }
  .maw-compatibility-list article { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 2px 8px; border-radius: 9px; padding: 7px 8px; background: #f6f7fb; }
  .maw-compatibility-list article > span { color: #354057; font-size: 9px; font-weight: 800; }
  .maw-compatibility-list article > strong { font-size: 8px; }
  .maw-compatibility-list article > strong.available { color: #248153; }
  .maw-compatibility-list article > strong.unavailable { color: #a03b43; }
  .maw-compatibility-list article > strong.disabled { color: #777f90; }
  .maw-compatibility-list article > strong.native { color: #4755b5; }
  .maw-compatibility-list article > strong.recovering { color: #80621e; }
  .maw-compatibility-list article > small { grid-column: 1 / -1; color: #788195; font-size: 8px; line-height: 1.4; }
  .maw-compatibility-privacy { margin: 0; color: #7b8496; font-size: 8px; line-height: 1.45; }
  .maw-binding { display: grid; gap: 10px; margin-top: 14px; border-top: 1px solid #e1e4ef; padding-top: 14px; }
  .maw-section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .maw-section-heading strong { display: block; color: #29334b; font-size: 12px; }
  .maw-section-heading span { display: block; margin-top: 3px; color: #747d90; font-size: 10px; line-height: 1.4; }
  .maw-binding-actions { display: flex; flex: none; gap: 8px; }
  .maw-text { border: 0; padding: 2px; color: var(--maw-pine); background: transparent; cursor: pointer; font: 800 10px Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-text.danger { color: #a13b45; }
  .maw-binding-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .maw-binding-grid button { display: flex; align-items: center; gap: 7px; min-width: 0; border: 1px solid #d8dceb; border-radius: 10px; padding: 8px 9px; color: #566075; background: #fff; cursor: pointer; font: 700 10px Inter, system-ui, sans-serif; text-align: left; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .maw-binding-grid button span { display: grid; flex: none; width: 17px; height: 17px; place-items: center; border-radius: 6px; color: #fff; background: #9aa2b6; }
  .maw-binding-grid button.bound { border-color: #bee1cc; color: #2c6746; background: #f0faf4; }
  .maw-binding-grid button.bound span { background: #36a269; }
  .maw-binding-grid button:disabled { cursor: wait; opacity: .6; }
  .maw-error { border-radius: 9px; padding: 8px; color: #8f3039; background: #fff0f1; font-size: 10px; line-height: 1.4; }
  .maw-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; margin-top: 12px; border-radius: 11px; padding: 3px; background: #eef0f6; }
  .maw-tabs button { overflow: hidden; border: 0; border-radius: 8px; padding: 7px 4px; color: #687185; background: transparent; cursor: pointer; font: 800 9px Inter, system-ui, sans-serif; text-overflow: ellipsis; white-space: nowrap; }
  .maw-tabs button[aria-current='page'] { color: #fff; background: var(--maw-pine); }
  .maw-tab-content { margin-top: 12px; }
  .maw-capabilities { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
  .maw-capabilities span { border-radius: 999px; padding: 4px 7px; color: #3c5684; background: #eaf0fb; font: 700 8px ui-monospace, monospace; }
  .maw-feature-stack { display: grid; gap: 10px; }
  .maw-feature-stack input, .maw-feature-stack select, .maw-feature-stack textarea { box-sizing: border-box; width: 100%; border: 1px solid #d3d7e5; border-radius: 9px; padding: 8px 9px; color: #273047; background: #fff; font: 500 10px/1.45 Inter, system-ui, sans-serif; }
  .maw-feature-stack textarea { resize: vertical; }
  .maw-provider-empty { display: grid; gap: 6px; border: 1px dashed #c9cede; border-radius: 11px; padding: 12px; color: #505a70; background: #f7f8fc; }
  .maw-provider-empty strong { color: #2d374f; font-size: 11px; }
  .maw-provider-empty p { margin: 0; font-size: 9px; line-height: 1.5; }
  .maw-provider-empty button { justify-self: start; border: 0; border-radius: 6px; padding: 7px 9px; color: #fff; background: var(--maw-pine); cursor: pointer; font: 800 9px Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-field { display: grid; gap: 4px; color: #414a60; font-size: 9px; font-weight: 800; }
  .maw-check { display: flex; align-items: center; gap: 7px; color: #535d72; font-size: 9px; font-weight: 700; }
  .maw-check input { width: 14px; margin: 0; }
  .maw-two-fields { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 7px; min-width: 0; }
  .maw-button { min-height: 33px; border: 0; border-radius: 9px; padding: 7px 10px; cursor: pointer; font: 800 10px Inter, system-ui, sans-serif; }
  .maw-button.primary { color: #fff; background: var(--maw-pine); }
  .maw-button.secondary { border: 1px solid #d5d9e8; color: #3d465d; background: #fff; }
  .maw-button:disabled { cursor: not-allowed; opacity: .5; }
  .maw-result { display: grid; gap: 9px; border-top: 1px solid #e1e4ef; padding-top: 10px; }
  .maw-result ul { margin: 0; padding-left: 17px; color: #606a7e; font-size: 9px; line-height: 1.5; }
  .maw-actions { display: flex; flex-wrap: wrap; gap: 5px; }
  .maw-actions button { border: 1px solid #d5d9e8; border-radius: 8px; padding: 6px 8px; color: #434c64; background: #fff; cursor: pointer; font: 800 9px Inter, system-ui, sans-serif; }
  .maw-notice { border-radius: 9px; padding: 8px; color: #256044; background: #eaf8f0; font-size: 10px; line-height: 1.4; }
  .maw-list { display: grid; gap: 7px; max-height: 340px; overflow: auto; }
  .maw-list article { display: grid; gap: 6px; border: 1px solid #e0e3ed; border-radius: 10px; padding: 9px; background: #fff; }
  .maw-list article > div { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .maw-list strong { color: #30394f; font-size: 10px; }
  .maw-list span { color: #828a9a; font-size: 8px; }
  .maw-list p { display: -webkit-box; overflow: hidden; margin: 0; color: #687185; font-size: 9px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 3; white-space: pre-wrap; }
  .maw-list article > button { justify-self: start; border: 0; padding: 0; color: var(--maw-pine); background: transparent; cursor: pointer; font: 800 9px Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-empty { border: 1px dashed #d1d5e1; border-radius: 10px; padding: 18px; color: #778094; font-size: 10px; line-height: 1.5; text-align: center; }
  .maw-tool-section { display: grid; gap: 8px; border-bottom: 1px solid #e4e6ee; padding-bottom: 11px; }
  .maw-tool-section > strong { color: #30394f; font-size: 10px; }
  .maw-tool-hint { margin: -2px 0 0; color: #778094; font-size: 9px; line-height: 1.45; }
  .maw-summary-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .maw-summary-controls > .maw-button, .maw-summary-controls > .maw-empty { grid-column: 1 / -1; }
  .maw-summary-result { display: grid; gap: 8px; border: 1px solid #dfe3ee; border-radius: 11px; padding: 11px; color: #3d465b; background: #fff; }
  .maw-summary-result h3, .maw-summary-result h4 { margin: 0; color: #2d374f; }
  .maw-summary-result h3 { font-size: 11px; }
  .maw-summary-result h4 { font-size: 9px; }
  .maw-summary-result p { margin: 0; font-size: 10px; line-height: 1.55; white-space: pre-wrap; }
  .maw-summary-result section { display: grid; gap: 4px; }
  .maw-summary-result ul { margin: 0; padding-left: 16px; color: #5f687c; font-size: 9px; line-height: 1.5; }
  .maw-inline { display: grid; grid-template-columns: 1fr auto; gap: 4px; }
  .maw-inline button { width: 33px; border: 0; border-radius: 6px; color: #fff; background: var(--maw-pine); cursor: pointer; }
  .maw-inline button:disabled { cursor: not-allowed; opacity: .55; }
  .maw-timeline-section { gap: 7px; }
  .maw-timeline-filters { display: grid; grid-template-columns: minmax(0,1fr) 112px; gap: 5px; }
  .maw-timeline-filters input, .maw-timeline-filters select { min-width: 0; border: 1px solid #d8dce8; border-radius: 8px; padding: 7px; color: #3f485d; background: #fff; font: 600 8px Inter, system-ui, sans-serif; }
  .maw-timeline-selection-bar, .maw-timeline-export-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; color: #6e778a; font: 700 8px Inter, system-ui, sans-serif; }
  .maw-timeline-selection-bar span, .maw-timeline-export-actions span { margin-right: auto; }
  .maw-timeline-selection-bar button, .maw-timeline-export-actions button { border: 1px solid #d8dce8; border-radius: 7px; padding: 5px 7px; color: #4c5570; background: #fff; cursor: pointer; font: 800 8px Inter, system-ui, sans-serif; }
  .maw-timeline-selection-bar button:disabled { cursor: not-allowed; opacity: .45; }
  .maw-timeline-export-actions { border-radius: 6px; padding: 6px 7px; color: var(--maw-pine); background: var(--maw-sage); }
  .maw-timeline { display: grid; gap: 5px; max-height: 420px; overflow: auto; padding: 2px; overscroll-behavior: contain; }
  .maw-timeline article { display: grid; gap: 4px; margin-left: calc(var(--maw-timeline-level, 0) * 12px); border: 1px solid #e1e4ed; border-radius: 10px; padding: 4px; background: #fff; transition: margin-left .14s ease, border-color .14s ease, background .14s ease; }
  .maw-timeline article.active { border-color: #8ea399; background: var(--maw-sage); box-shadow: 0 0 0 2px rgba(41,70,61,.08); }
  .maw-timeline-node-row { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 3px; min-width: 0; }
  .maw-timeline-select { width: 13px; height: 13px; margin: 0 1px; accent-color: var(--maw-pine); }
  .maw-timeline-main { display: grid; grid-template-columns: auto minmax(0,1fr); align-items: start; gap: 7px; min-width: 0; border: 0; padding: 5px 4px; color: #354057; background: transparent; cursor: pointer; text-align: left; }
  .maw-timeline-main > span { display: grid; width: 18px; height: 18px; place-items: center; border-radius: 4px; color: #fff; background: #70877c; font-size: 8px; }
  .maw-timeline-main div { min-width: 0; }
  .maw-timeline-main strong { font-size: 8px; text-transform: uppercase; }
  .maw-timeline-main p { overflow: hidden; margin: 2px 0 0; color: #747d90; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
  .maw-timeline-main small { display: block; overflow: hidden; margin-top: 4px; color: #4e755d; font: 700 7px/1.35 Inter, system-ui, sans-serif; text-overflow: ellipsis; white-space: nowrap; }
  .maw-timeline-node-actions { display: flex; align-items: center; gap: 1px; }
  .maw-timeline-node-actions button { min-width: 22px; height: 24px; border: 0; border-radius: 6px; padding: 2px 4px; color: #667087; background: transparent; cursor: pointer; font: 800 10px/1 Inter, system-ui, sans-serif; }
  .maw-timeline-node-actions button:hover { background: #eceefa; }
  .maw-timeline-node-actions button:disabled { cursor: not-allowed; opacity: .25; }
  .maw-timeline-node-actions button.noted { color: #328458; background: #e7f6ed; }
  .maw-timeline-note-editor { display: grid; gap: 4px; border-top: 1px solid #e5e7ef; padding: 5px 4px 2px 20px; }
  .maw-timeline-note-editor textarea { width: 100%; resize: vertical; border: 1px solid #d8dce8; border-radius: 7px; padding: 6px; color: #3f485d; background: #fff; font: 500 8px/1.4 Inter, system-ui, sans-serif; }
  .maw-timeline-note-editor > div { display: flex; justify-content: flex-end; gap: 4px; }
  .maw-timeline-note-editor button { border: 1px solid #d8dce8; border-radius: 6px; padding: 4px 7px; color: #4c5570; background: #fff; cursor: pointer; font: 800 8px Inter, system-ui, sans-serif; }
  .maw-timeline-main:focus-visible, .maw-timeline-node-actions button:focus-visible, .maw-timeline-selection-bar button:focus-visible, .maw-timeline-export-actions button:focus-visible { outline: 3px solid #f2b84b; outline-offset: 2px; }
  .maw-branch-button-layer { position: fixed; z-index: 3; inset: 0; pointer-events: none; }
  .maw-branch-trigger { position: fixed; display: grid; width: 30px; height: 26px; place-items: center; border: 1px solid #1f3a31; border-radius: 6px; padding: 0; color: #fff; opacity: .78; background: var(--maw-pine); box-shadow: 0 5px 14px rgba(35,51,45,.16); cursor: pointer; pointer-events: auto; font: 900 14px/1 Aptos, "Segoe UI Variable", system-ui, sans-serif; transition: opacity .14s ease, transform .14s ease; }
  .maw-branch-trigger:disabled { cursor: wait; opacity: .45; }
  .maw-branch-trigger:hover, .maw-branch-trigger:focus-visible { opacity: 1; transform: translateY(-1px); }
  .maw-branch-trigger:focus-visible { outline: 3px solid #f2b84b; outline-offset: 2px; }
  .maw-branch-floating-error { position: fixed; z-index: 16; right: 20px; bottom: 76px; max-width: min(420px, calc(100vw - 40px)); border-radius: 12px; padding: 10px 12px; color: #8a3030; background: #fff0f0; box-shadow: 0 12px 34px rgba(77,27,27,.22); pointer-events: auto; font: 600 11px/1.5 Inter, system-ui, sans-serif; }
  .maw-branch-floating-status, .maw-branch-applied { position: fixed; z-index: 16; right: 20px; bottom: 76px; max-width: min(420px, calc(100vw - 40px)); border-radius: 12px; padding: 10px 12px; color: #276345; background: #eaf8f0; box-shadow: 0 12px 34px rgba(30,77,52,.18); pointer-events: none; font: 700 11px/1.5 Inter, system-ui, sans-serif; }
  .maw-branch-handoff-actions { display: flex; flex-wrap: wrap; gap: 7px; }
  .maw-branch-handoff-actions button { border: 1px solid #d4d9e8; border-radius: 9px; padding: 8px 11px; color: #414b64; background: #fff; cursor: pointer; font: 800 10px Inter, system-ui, sans-serif; }
  .maw-branch-handoff-actions button.primary { color: #fff; border-color: var(--maw-pine); background: var(--maw-pine); }
  .maw-branch-handoff-actions button:disabled { cursor: not-allowed; opacity: .42; }
  .maw-branch-handoff { position: fixed; z-index: 18; right: 18px; bottom: 76px; display: grid; gap: 9px; width: min(440px, calc(100vw - 36px)); border: 1px solid var(--maw-line); border-radius: 10px; padding: 13px; color: var(--maw-ink); background: var(--maw-surface); box-shadow: 0 16px 42px rgba(35,51,45,.2); pointer-events: auto; }
  .maw-branch-handoff strong { display: block; font: 850 13px/1.35 Inter, system-ui, sans-serif; }
  .maw-branch-handoff p { margin: 3px 0; color: #626c82; font: 550 10px/1.5 Inter, system-ui, sans-serif; }
  .maw-branch-handoff a, .maw-branch-handoff small { font: 650 9px/1.45 Inter, system-ui, sans-serif; }
  .maw-branch-navigator { position: fixed; z-index: 18; top: 18px; right: 18px; display: grid; width: min(250px, calc(100vw - 36px)); color: #273149; pointer-events: auto; font-family: Inter, system-ui, sans-serif; }
  .maw-branch-current { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 2px 8px; border: 1px solid var(--maw-line); border-radius: 8px; padding: 9px 11px; color: var(--maw-ink); background: var(--maw-surface); box-shadow: 0 8px 24px rgba(35,51,45,.14); cursor: pointer; text-align: left; }
  .maw-branch-current > span:first-child { grid-column: 1 / -1; color: #747d92; font: 700 8px/1.2 Inter, system-ui, sans-serif; text-transform: uppercase; letter-spacing: .08em; }
  .maw-branch-current strong { overflow: hidden; font: 850 11px/1.35 Inter, system-ui, sans-serif; text-overflow: ellipsis; white-space: nowrap; }
  .maw-branch-menu { display: grid; gap: 4px; max-height: min(360px, calc(100vh - 150px)); overflow: auto; margin-top: 6px; border: 1px solid var(--maw-line); border-radius: 8px; padding: 6px; background: var(--maw-surface); box-shadow: 0 14px 38px rgba(35,51,45,.18); }
  .maw-branch-menu button { display: grid; gap: 2px; border: 0; border-radius: 9px; padding: 8px 9px; color: #3c465e; background: transparent; cursor: pointer; text-align: left; }
  .maw-branch-menu button:hover, .maw-branch-menu button.active { color: var(--maw-pine); background: var(--maw-sage); }
  .maw-branch-menu button:disabled { cursor: not-allowed; opacity: .52; }
  .maw-branch-menu span { overflow: hidden; font: 800 10px/1.35 Inter, system-ui, sans-serif; text-overflow: ellipsis; white-space: nowrap; }
  .maw-branch-menu small { color: #7a8397; font: 650 8px/1.3 Inter, system-ui, sans-serif; }
  .maw-markup-trigger { position: fixed; z-index: 3; min-width: 38px; height: 28px; border: 1px solid #1f3a31; border-radius: 6px; padding: 0 7px; color: #fff; background: var(--maw-pine); box-shadow: 0 6px 18px rgba(35,51,45,.18); cursor: pointer; pointer-events: auto; font: 800 11px/1 Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-markup-trigger.formula { color: #304f43; background: rgba(224,247,234,.97); }
  .maw-markup-trigger:focus-visible { outline: 3px solid #f2b84b; outline-offset: 2px; }
  .maw-formula-copy-feedback { position: fixed; z-index: 4; width: max-content; max-width: min(210px, calc(100vw - 16px)); border: 1px solid #cfe0d7; border-radius: 7px; padding: 6px 8px; color: #285544; background: rgba(248,252,249,.98); box-shadow: 0 6px 18px rgba(35,51,45,.14); pointer-events: none; font: 700 9px/1.4 Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-formula-copy-feedback.error { border-color: #e6caca; color: #8f3039; background: rgba(255,246,246,.98); }
  .maw-markup-backdrop { position: fixed; z-index: 20; inset: 0; display: grid; place-items: center; padding: 24px; background: rgba(25,38,33,.48); backdrop-filter: blur(7px); pointer-events: auto; }
  .maw-markup-dialog { display: grid; gap: 12px; width: min(920px, calc(100vw - 32px)); max-height: min(760px, calc(100vh - 32px)); overflow: auto; border: 1px solid var(--maw-line); border-radius: 12px; padding: 16px; color: var(--maw-ink); background: var(--maw-surface); box-shadow: 0 24px 72px rgba(30,41,37,.3); }
  .maw-markup-dialog > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .maw-markup-dialog > header strong { font-size: 15px; }
  .maw-markup-dialog > header button { width: 30px; height: 30px; border: 0; border-radius: 9px; color: #596174; background: #edf0f6; cursor: pointer; font: 700 18px/1 Inter, system-ui, sans-serif; }
  .maw-markup-dialog.formula { gap: 18px; width: min(680px, calc(100vw - 32px)); border-color: #d4dfd9; border-radius: 20px; padding: 22px; background: #fbfcfa; box-shadow: 0 28px 80px rgba(22,42,34,.28), 0 2px 8px rgba(22,42,34,.08); font-family: Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-markup-dialog.formula > header { min-height: 40px; padding-bottom: 2px; }
  .maw-markup-dialog.formula > header strong { display: flex; align-items: center; gap: 11px; color: #172a23; font: 750 18px/1.25 Aptos, "Segoe UI Variable", system-ui, sans-serif; letter-spacing: -.015em; }
  .maw-markup-dialog.formula > header strong::before { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid #b9cec3; border-radius: 10px; color: #234c3e; background: #e8f2ed; content: "ƒx"; font: 700 14px/1 Georgia, "Times New Roman", serif; box-shadow: inset 0 1px 0 rgba(255,255,255,.8); }
  .maw-markup-dialog.formula > header button { width: 34px; height: 34px; border: 1px solid transparent; border-radius: 10px; color: #65736d; background: #eef2ef; transition: border-color .14s ease, color .14s ease, background .14s ease; }
  .maw-markup-dialog.formula > header button:hover { border-color: #d0ddd6; color: #203d33; background: #e5ece8; }
  .maw-formula-preview { display: grid; gap: 12px; min-height: 108px; border: 1px solid #d9e4de; border-radius: 15px; padding: 15px 18px 19px; background: linear-gradient(145deg,#f4f8f5 0%,#edf4f0 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.9); }
  .maw-formula-preview > span { color: #6a7b74; font: 700 9px/1.2 Aptos, "Segoe UI Variable", system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; }
  .maw-formula-preview > div { align-self: center; overflow: auto; color: #183029; font: 500 23px/1.45 Cambria Math, STIX Two Math, "Times New Roman", serif; text-align: center; white-space: nowrap; }
  .maw-markup-dialog.formula .maw-notice, .maw-markup-dialog.formula .maw-error { border: 1px solid #cfe0d7; border-radius: 11px; padding: 10px 12px; }
  .maw-markup-warning { display: grid; gap: 4px; border: 1px solid #e8d8ab; border-radius: 12px; padding: 12px 14px; color: #725a1f; background: #fff9e9; }
  .maw-markup-warning strong { font: 750 11px/1.4 Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-markup-warning span { font: 500 10px/1.5 Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-formula-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; }
  .maw-formula-actions > p { grid-column: 1 / -1; margin: 0 0 1px; color: #687871; font: 650 10px/1.4 Aptos, "Segoe UI Variable", system-ui, sans-serif; }
  .maw-formula-actions > button { display: grid; grid-template-columns: 38px minmax(0,1fr) 16px; align-items: center; gap: 10px; min-height: 54px; border: 1px solid #d8e1dc; border-radius: 13px; padding: 8px 13px 8px 9px; color: #273d35; background: #fff; cursor: pointer; font: 650 11px/1.35 Aptos, "Segoe UI Variable", system-ui, sans-serif; text-align: left; transition: transform .14s ease, border-color .14s ease, background .14s ease, box-shadow .14s ease; }
  .maw-formula-actions > button::before { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; color: #365b4e; background: #edf3f0; content: attr(data-symbol); font: 750 10px/1 Aptos, "Segoe UI Variable", system-ui, sans-serif; letter-spacing: -.02em; }
  .maw-formula-actions > button[data-preferred="true"] { border-color: #769b8b; color: #173c2f; background: #eef6f2; box-shadow: inset 3px 0 0 #315e4e; }
  .maw-formula-actions > button[data-preferred="true"]::before { color: #fff; background: #315e4e; }
  .maw-formula-actions > button[data-format="rendered"] { grid-column: 1 / -1; }
  .maw-formula-actions > button:hover:not(:disabled) { transform: translateY(-1px); border-color: #87a89a; background: #f5f9f7; box-shadow: 0 7px 18px rgba(36,67,56,.10); }
  .maw-formula-actions > button:active:not(:disabled) { transform: translateY(0); box-shadow: 0 2px 6px rgba(36,67,56,.08); }
  .maw-formula-actions > button:disabled { cursor: not-allowed; opacity: .44; }
  .maw-copy-glyph { position: relative; width: 13px; height: 13px; opacity: .62; }
  .maw-copy-glyph::before, .maw-copy-glyph::after { position: absolute; width: 7px; height: 8px; border: 1.4px solid currentColor; border-radius: 2px; content: ""; }
  .maw-copy-glyph::before { top: 1px; left: 1px; }
  .maw-copy-glyph::after { right: 1px; bottom: 1px; background: inherit; }
  .maw-markup-tabs { display: inline-flex; justify-self: start; gap: 3px; border-radius: 10px; padding: 3px; background: #eceefa; }
  .maw-markup-tabs button { border: 0; border-radius: 7px; padding: 7px 11px; color: #626b80; background: transparent; cursor: pointer; font: 800 10px Inter, system-ui, sans-serif; }
  .maw-markup-tabs button[aria-current='page'] { color: #fff; background: var(--maw-pine); }
  .maw-markup-source { max-height: 520px; overflow: auto; margin: 0; border: 1px solid #dfe3ee; border-radius: 12px; padding: 14px; color: #273149; background: #f4f6fa; font: 12px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; }
  .maw-markup-loading { border: 1px dashed #cdd2df; border-radius: 12px; padding: 24px; color: #687286; background: #f6f7fb; font-size: 11px; text-align: center; }
  .maw-mermaid-preview { min-height: 160px; overflow: auto; border: 1px solid #dfe3ee; border-radius: 12px; padding: 16px; background: #fff; }
  .maw-mermaid-preview svg { display: block; max-width: 100%; height: auto; margin: auto; }
  .maw-markup-actions { display: flex; flex-wrap: wrap; gap: 7px; }
  .maw-markup-actions button { border: 1px solid #d4d9e8; border-radius: 9px; padding: 8px 10px; color: #414b64; background: #fff; cursor: pointer; font: 800 10px Inter, system-ui, sans-serif; }
  .maw-markup-actions button:first-child { color: #fff; background: var(--maw-pine); border-color: var(--maw-pine); }
  .maw-markup-actions button:disabled { cursor: not-allowed; opacity: .42; }
  .maw-markup-dialog button:focus-visible { outline: 3px solid #f2b84b; outline-offset: 2px; }
  @media (max-width: 640px) { .maw-selection-preview { display: none; } .maw-selection-popover { grid-template-columns: 1fr auto; } .maw-selection-actions { flex-wrap: wrap; } .maw-selection-dismiss { grid-column: 2; grid-row: 1; } .maw-branch-meta > div { grid-template-columns: 1fr; gap: 3px; } .maw-branch-handoff { right: 10px; bottom: 70px; width: calc(100vw - 20px); } .maw-markup-backdrop { padding: 10px; } .maw-markup-dialog.formula { width: calc(100vw - 20px); border-radius: 16px; padding: 16px; } .maw-formula-actions { grid-template-columns: 1fr; } .maw-formula-actions > button[data-format="rendered"] { grid-column: auto; } }
  @media (prefers-reduced-motion: no-preference) { .maw-launcher { transition: transform .16s ease; } .maw-launcher:hover { transform: translateY(-2px); } .maw-markup-dialog.formula { animation: maw-formula-dialog-in .16s ease-out both; } }
  @media (prefers-reduced-motion: reduce) { .maw-effect-layer { display: none !important; } }
  @keyframes maw-formula-dialog-in { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: none; } }
`;
