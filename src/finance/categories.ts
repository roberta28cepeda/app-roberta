import { Car, HeartPulse, Home, ShoppingBag, Sparkles, Tags, Utensils } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type CategoryMeta = { label: string; color: string; icon: LucideIcon }
export type SavingsIdea = { title: string; text: string }

export const defaultCategoryNames = ['Alimentação', 'Casa', 'Transporte', 'Lazer', 'Saúde', 'Compras', 'Educação', 'Contas']

const defaults: Record<string, CategoryMeta> = {
  Alimentação: { label: 'Alimentação', color: '#e58eab', icon: Utensils },
  Casa: { label: 'Casa', color: '#79b8d7', icon: Home },
  Transporte: { label: 'Transporte', color: '#6e9ed0', icon: Car },
  Lazer: { label: 'Lazer', color: '#c58db8', icon: Sparkles },
  Saúde: { label: 'Saúde', color: '#78bfc6', icon: HeartPulse },
  Compras: { label: 'Compras', color: '#8aafe4', icon: ShoppingBag },
  Educação: { label: 'Educação', color: '#78a8c8', icon: Tags },
  Contas: { label: 'Contas', color: '#cc9a72', icon: Home },
}

const fallbackColors = ['#d2799b', '#70aeca', '#8b9fdd', '#67aaa3', '#b287c1', '#78a8c8', '#cc9a72', '#7695c5']
const ideas: Record<string, SavingsIdea> = {
  Alimentação: { title: 'Planeje antes de pedir', text: 'Escolha algumas refeições da semana e defina um teto para delivery. Pequenas decisões antes da fome reduzem os gastos por impulso.' },
  Casa: { title: 'Revise os gastos fixos', text: 'Liste assinaturas, tarifas e serviços recorrentes. Uma renegociação por mês já pode abrir espaço para sua meta.' },
  Transporte: { title: 'Agrupe seus trajetos', text: 'Combine compromissos na mesma saída e acompanhe o custo por semana. O que parece pequeno se acumula no fim do mês.' },
  Lazer: { title: 'Crie um lazer sem culpa', text: 'Escolha um programa pago para a semana e complete com opções gratuitas. Assim você preserva a diversão e o limite.' },
  Saúde: { title: 'Cuide do planejado', text: 'Separe uma reserva para saúde e compare preços de itens recorrentes. Prevenção costuma custar menos que urgência.' },
  Compras: { title: 'Espere 24 horas', text: 'Deixe a compra no carrinho por um dia. Se ainda fizer sentido depois desse intervalo, ela entra no orçamento com mais clareza.' },
}

export function getCategoryMeta(name: string): CategoryMeta {
  const standard = defaults[name]
  if (standard) return standard
  const normalized = name.trim().toLocaleLowerCase('pt-BR')
  let hash = 0
  for (const character of normalized) hash = (hash * 31 + character.codePointAt(0)!) >>> 0
  return { label: name, color: fallbackColors[hash % fallbackColors.length], icon: Tags }
}

export function getSavingsIdea(name?: string): SavingsIdea {
  return (name && ideas[name]) || {
    title: 'Observe esta categoria por uma semana',
    text: 'Anote os gastos desta categoria durante alguns dias. Com esse retrato, fica mais fácil escolher um ajuste pequeno que combine com a sua rotina.',
  }
}
