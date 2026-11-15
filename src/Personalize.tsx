import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Camera, Check, RotateCcw, Trash2, X } from 'lucide-react'
import type { ProfileSettings } from './types'
import { applyTheme, colorPresets, compressAvatar, DEFAULT_PRIMARY, DEFAULT_SECONDARY, normalizeHex } from './theme'

type Props = {
  profile: ProfileSettings | null
  fallbackName: string
  onSave: (profile: ProfileSettings) => Promise<void>
  onClose: () => void
}

export default function Personalize({ profile, fallbackName, onSave, onClose }: Props) {
  const [name, setName] = useState(profile?.name ?? '')
  const [photo, setPhoto] = useState(profile?.photo ?? '')
  const [primary, setPrimary] = useState(normalizeHex(profile?.primary) ?? DEFAULT_PRIMARY)
  const [secondary, setSecondary] = useState(normalizeHex(profile?.secondary) ?? DEFAULT_SECONDARY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const saved = useRef(false)
  const initial = (name.trim() || fallbackName).trim().charAt(0).toLocaleUpperCase('pt-BR') || 'M'

  function preview(nextPrimary: string, nextSecondary: string) {
    setPrimary(nextPrimary)
    setSecondary(nextSecondary)
    applyTheme({ primary: nextPrimary, secondary: nextSecondary })
  }

  function close() {
    // Sem salvar, volta às cores que estavam valendo.
    if (!saved.current) applyTheme(profile)
    onClose()
  }

  async function pickPhoto(file?: File) {
    if (!file) return
    setError('')
    try { setPhoto(await compressAvatar(file)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível usar essa foto.') }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({ id: 'profile', name: name.trim().slice(0, 40), photo, primary, secondary })
      saved.current = true
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-label="Personalizar">
        <div className="modal-heading">
          <div><span className="section-kicker">Do seu jeito</span><h2>Personalizar</h2></div>
          <button className="icon-button" type="button" onClick={close} aria-label="Fechar"><X size={18} /></button>
        </div>
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          <div className="personalize-photo">
            <span className="personalize-avatar">{photo ? <img src={photo} alt="Sua foto" /> : initial}</span>
            <div className="personalize-photo-actions">
              <button className="ghost-button" type="button" onClick={() => fileInput.current?.click()}><Camera size={14} />{photo ? 'Trocar foto' : 'Escolher foto'}</button>
              {photo && <button className="ghost-button" type="button" onClick={() => setPhoto('')}><Trash2 size={14} />Remover</button>}
            </div>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event) => { void pickPhoto(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
          </div>
          <label>Seu nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder={fallbackName} maxLength={40} /></label>
          <div>
            <span className="personalize-label">Combinações de cores</span>
            <div className="personalize-presets">{colorPresets.map((preset) => (
              <button key={preset.name} type="button" className={`personalize-preset${primary === preset.primary && secondary === preset.secondary ? ' selected' : ''}`} onClick={() => preview(preset.primary, preset.secondary)} aria-label={`Cores ${preset.name}`}>
                <span style={{ background: preset.primary }} /><span style={{ background: preset.secondary }} /><small>{preset.name}</small>
              </button>
            ))}</div>
          </div>
          <div className="form-two">
            <label>Cor principal<input className="personalize-color" type="color" value={primary} onChange={(event) => preview(event.target.value, secondary)} /></label>
            <label>Cor de destaque<input className="personalize-color" type="color" value={secondary} onChange={(event) => preview(primary, event.target.value)} /></label>
          </div>
          <button className="ghost-button" type="button" onClick={() => preview(DEFAULT_PRIMARY, DEFAULT_SECONDARY)}><RotateCcw size={14} />Voltar às cores originais</button>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="primary-button form-submit" type="submit" disabled={saving}><Check size={16} />{saving ? 'Salvando…' : 'Salvar'}</button>
        </form>
      </section>
    </div>
  )
}
