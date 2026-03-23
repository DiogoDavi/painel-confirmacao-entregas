export interface Solicitacao {
  id: string
  destinatario: string
  email: string
  entrega_prevista: string | null
  status: string
  emails_adicionais: string[] | null
  confirmed_at: string | null
  created_at: string
  responsavel_recebimento?: string
  documento_responsavel?: string
  motivo_recusa?: string
  itens?: ItemSolicitacao[]
}

export interface ItemSolicitacao {
  id: string
  solicitacao_id: string
  categoria: string
  cod_produto: string
  produto: string
  quantidade_cf: number
  data_vencimento: string
  num_transporte: string | null
  valor: number | null
  extras: any
}

export interface Produto {
  PRODUTO: string
  "COD PRODUTO": string
  CATEGORIA: string
  "QUANTIDADE CF": number
  "DATA VENCIMENTO": string
  NUM_TRANSPORTE?: string | number
  VALOR?: string | number
  [key: string]: string | number | undefined
}
