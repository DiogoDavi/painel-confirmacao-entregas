"use client"

import { useState, useEffect } from "react"
import { 
  Button, 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  Checkbox, 
  Textarea, 
  Label, 
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui"
import { Solicitacao, Produto, ItemSolicitacao } from "@/lib/types"
import { CheckCircle2, XCircle, Package, User, ArrowLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface ConfirmationFormProps {
  solicitacaoId: string
  readOnly?: boolean
}

export function ConfirmationForm({ solicitacaoId, readOnly = false }: ConfirmationFormProps) {
  const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null)
  const [concordo, setConcordo] = useState(false)
  const [showRelato, setShowRelato] = useState(false)
  const [relato, setRelato] = useState("")
  const [concluido, setConcluido] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [responsavel, setResponsavel] = useState("")
  const [documento, setDocumento] = useState("")

  useEffect(() => {
    const fetchSolicitacao = async () => {
      const { data, error } = await supabase
        .from('solicitacoes')
        .select('*, itens:itens_solicitacao(*)')
        .eq('id', solicitacaoId)
        .single()
      
      if (error) {
        console.error('Erro ao buscar solicitação:', error)
        setLoading(false)
        return
      }

      if (data) {
        setSolicitacao(data)
        const status = data.status.toLowerCase()
        if (status !== "pendente") {
          setResponsavel(data.responsavel_recebimento || "")
          setDocumento(data.documento_responsavel || "")
          setRelato(data.motivo_recusa || "")
          setConcordo(status === "confirmado")
          if (status === "recusado") setShowRelato(true)
        }
      }
      setLoading(false)
    }

    fetchSolicitacao()
  }, [solicitacaoId])

  const handleConfirmar = async () => {
    if (!solicitacao || readOnly) return

    const { error } = await supabase
      .from('solicitacoes')
      .update({ 
        status: "confirmado", 
        confirmed_at: new Date().toISOString(),
        responsavel_recebimento: responsavel,
        documento_responsavel: documento 
      })
      .eq('id', solicitacaoId)

    if (error) {
      console.error('Erro ao confirmar:', error)
      alert('Erro ao confirmar recebimento')
      return
    }

    await notificarEmailsAdicionais("Confirmado", solicitacao)
    setConcluido(true)
  }

  const notificarEmailsAdicionais = async (status: string, s: Solicitacao) => {
    console.log("Tentando notificar e-mails adicionais:", s.emails_adicionais)
    if (!s.emails_adicionais || s.emails_adicionais.length === 0) {
      console.log("Nenhum e-mail adicional para notificar.")
      return
    }

    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: s.emails_adicionais,
          subject: `Notificação: Recebimento ${status} - ${s.destinatario}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; padding: 20px;">
              <h2 style="color: #1a1a1a; margin-top: 0;">Notificação de Status</h2>
              <p style="color: #444; line-height: 1.6;">O destinatário <strong>${s.destinatario}</strong> ${status.toLowerCase() === 'confirmado' ? 'confirmou' : 'recusou'} o recebimento da mercadoria.</p>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Status:</strong> <span style="color: ${status.toLowerCase() === 'confirmado' ? '#059669' : '#dc2626'}; font-weight: bold;">${status}</span></p>
                <p style="margin: 5px 0 0 0;"><strong>Responsável:</strong> ${responsavel}</p>
                <p style="margin: 5px 0 0 0;"><strong>Documento:</strong> ${documento}</p>
                ${status.toLowerCase() === 'recusado' ? `<p style="margin: 5px 0 0 0;"><strong>Motivo da Recusa:</strong> ${relato}</p>` : ''}
              </div>
              <p style="color: #888; font-size: 12px; margin-top: 20px;">Data/Hora da Resposta: ${new Date().toLocaleString("pt-BR")}</p>
              <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
              <p style="color: #999; font-size: 11px;">Esta é uma notificação automática do sistema de recebimento SOLAR Coca-Cola.</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro na resposta da API de e-mail:", errorData);
      } else {
        console.log("Notificação enviada com sucesso para e-mails adicionais.");
      }
    } catch (error) {
      console.error("Erro ao notificar emails adicionais:", error);
    }
  }

  const handleRecusar = () => {
    setShowRelato(true)
  }

  const handleEnviarRelato = async () => {
    if (!relato.trim()) return

    const { error } = await supabase
      .from('solicitacoes')
      .update({
        status: "recusado",
        confirmed_at: new Date().toISOString(),
        motivo_recusa: relato.trim(),
        responsavel_recebimento: responsavel,
        documento_responsavel: documento
      })
      .eq('id', solicitacaoId)

    if (error) {
      console.error('Erro ao recusar:', error)
      alert('Erro ao enviar relato de recusa')
      return
    }
    
    await notificarEmailsAdicionais("Recusado", solicitacao)
    setConcluido(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (!solicitacao) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <XCircle className="h-16 w-16 mx-auto text-destructive" />
              <h2 className="text-xl font-semibold">Solicitação não encontrada</h2>
              <p className="text-muted-foreground">
                O link que você acessou não é válido ou a solicitação não existe.
              </p>
              {readOnly && (
                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = "/"}
                    className="w-full"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o Painel Admin
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (concluido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
              <h2 className="text-xl font-semibold text-green-700 dark:text-green-400">
                Obrigado!
              </h2>
              <p className="text-muted-foreground">
                Sua resposta foi registrada com sucesso.
              </p>
              {readOnly && (
                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = "/"}
                    className="w-full"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o Painel Admin
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const temItens = solicitacao.itens && solicitacao.itens.length > 0

  return (
    <div className="min-h-screen bg-muted/30 p-4 flex flex-col items-center justify-center gap-4">
      {readOnly && (
        <div className="max-w-4xl w-full flex justify-start">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => window.location.href = "/"}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o Painel Admin
          </Button>
        </div>
      )}
      <Card className="max-w-4xl w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            Confirmação de Recebimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p>
              Prezado(a) <strong>{solicitacao.destinatario}</strong>,
            </p>
            <p>
              Segue abaixo a lista de produtos que você receberá conforme agendamento:
            </p>
            <p className="text-sm text-muted-foreground">
              Entrega prevista: <strong>{solicitacao.entrega_prevista ? new Date(solicitacao.entrega_prevista).toLocaleString("pt-BR") : "-"}</strong>
            </p>

            {temItens ? (
              <div className="space-y-6">
                {(Object.entries(
                  solicitacao.itens!.reduce((acc: Record<string, ItemSolicitacao[]>, item) => {
                    if (!acc[item.categoria]) acc[item.categoria] = []
                    acc[item.categoria].push(item)
                    return acc
                  }, {})
                ) as [string, ItemSolicitacao[]][]).map(([categoria, prods]) => {
                  const ordenados = [...prods].sort((a, b) => 
                    new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()
                  )

                  return (
                    <div key={categoria} className="space-y-2">
                      <h3 className="font-bold text-sm uppercase tracking-wide border-b pb-1">
                        {categoria}
                      </h3>
                      <div className="overflow-x-auto rounded-lg border">
                        <Table className="text-xs">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="py-2 text-xs font-semibold">Código</TableHead>
                              <TableHead className="py-2 text-xs font-semibold">Produto</TableHead>
                              <TableHead className="py-2 text-xs font-semibold text-right">Qtd</TableHead>
                              <TableHead className="py-2 text-xs font-semibold">Data Vencimento</TableHead>
                              <TableHead className="py-2 text-xs font-semibold">Transporte</TableHead>
                              <TableHead className="py-2 text-xs font-semibold">Valor</TableHead>
                              {ordenados[0].extras && Object.keys(ordenados[0].extras).map((col) => (
                                <TableHead key={col} className="py-2 text-xs font-semibold">{col}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ordenados.map((p, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="py-1.5 font-mono text-xs">{p.cod_produto}</TableCell>
                                <TableCell className="py-1.5 text-xs">{p.produto}</TableCell>
                                <TableCell className="py-1.5 text-xs text-right">{p.quantidade_cf}</TableCell>
                                <TableCell className="py-1.5 text-xs">{new Date(p.data_vencimento).toLocaleDateString("pt-BR")}</TableCell>
                                <TableCell className="py-1.5 text-xs">{p.num_transporte ?? ""}</TableCell>
                                <TableCell className="py-1.5 text-xs">{p.valor ?? ""}</TableCell>
                                {p.extras && Object.entries(p.extras).map(([key, val]) => (
                                  <TableCell key={key} className="py-1.5 text-xs">{String(val)}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-muted-foreground italic">Nenhum produto especificado.</p>
            )}

            <p className="text-muted-foreground text-sm">
              Por favor, leia atentamente e marque a caixa de confirmação antes de prosseguir.
            </p>
          </div>

          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <User className="h-4 w-4" />
              Identificação do Responsável
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="responsavel">Nome do Responsável</Label>
                <Input 
                  id="responsavel" 
                  placeholder="Digite o nome completo" 
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="documento">CPF / Documento</Label>
                <Input 
                  id="documento" 
                  placeholder="Digite o número do documento" 
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3 bg-muted/30 p-4 rounded-lg border">
            <Checkbox
              id="concordo"
              checked={concordo}
              onCheckedChange={(checked) => {
                if (readOnly) return
                setConcordo(checked as boolean)
                if (checked) setShowRelato(false)
              }}
              disabled={readOnly}
            />
            <Label htmlFor="concordo" className="text-sm leading-relaxed cursor-pointer">
              Confirmo que estou de acordo com a lista de produtos acima mencionada e que receberei a mercadoria conforme especificado.
            </Label>
          </div>

          <div className="flex flex-wrap gap-3">
            {!readOnly && (
              <>
                <Button
                  onClick={handleConfirmar}
                  disabled={!concordo || !responsavel || !documento}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirmar Recebimento
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRecusar}
                  disabled={concordo || !responsavel || !documento}
                  className="hover:bg-red-700 transition-colors"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Recusar
                </Button>
              </>
            )}
            {readOnly && (
              <div className="flex items-center gap-2 text-muted-foreground italic">
                Modo de visualização (somente leitura)
              </div>
            )}
          </div>

          {showRelato && (
            <div className="space-y-4 border-t pt-4">
              <p className="font-medium">Motivo da recusa:</p>
              <Textarea
                value={relato}
                onChange={(e) => setRelato(e.target.value)}
                placeholder="Descreva o motivo da recusa..."
                rows={4}
                disabled={readOnly}
              />
              {!readOnly && (
                <Button
                  onClick={handleEnviarRelato}
                  disabled={!relato.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Enviar Relato
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}