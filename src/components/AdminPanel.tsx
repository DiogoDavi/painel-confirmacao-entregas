"use client"

import * as React from "react"
import { useState, useCallback, useEffect } from "react"
import { 
  Button, 
  Input, 
  Textarea, 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Separator,
  Label,
  Dialog
} from "@/components/ui"
import { Solicitacao, Produto, ItemSolicitacao } from "@/lib/types"
import { Plus, Mail, FileSpreadsheet, ExternalLink, Upload, Trash2, Eye, Download, Copy, Loader2, Share2 } from "lucide-react"
import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabase"

export function AdminPanel() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [emailsAdicionais, setEmailsAdicionais] = useState("")
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [data, setData] = useState("")
  const [hora, setHora] = useState("")
  const [produtos, setProdutos] = useState("")
  const [linkGerado, setLinkGerado] = useState("")
  const [emailEnviado, setEmailEnviado] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [produtosImportados, setProdutosImportados] = useState<Record<string, Produto[]>>({})
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [solicitacaoToDelete, setSolicitacaoToDelete] = useState<string | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  const fetchSolicitacoes = useCallback(async () => {
    const { data, error } = await supabase
      .from('solicitacoes')
      .select('*, itens:itens_solicitacao(*)')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Erro ao buscar solicitações:', error)
      return
    }
    setSolicitacoes(data || [])
  }, [])

  useEffect(() => {
    fetchSolicitacoes()
  }, [fetchSolicitacoes])

  useEffect(() => {
    const channel = supabase
      .channel('solicitacoes_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes' }, () => {
        fetchSolicitacoes()
      })
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchSolicitacoes])

  const gerarLink = useCallback(async () => {
    if (!nome || !email || !data || !hora) {
      alert("Preencha todos os campos obrigatórios")
      return
    }

    setIsGenerating(true)
    try {
      const entregaPrevista = `${data}T${hora}:00`
      const emailsAdicionaisArray = emailsAdicionais.split(",").map((e) => e.trim()).filter(Boolean)

      const { data: novaSolicitacao, error: errorSolicitacao } = await supabase
        .from('solicitacoes')
        .insert([{
          destinatario: nome,
          email: email,
          entrega_prevista: entregaPrevista,
          status: 'pendente',
          emails_adicionais: emailsAdicionaisArray.length > 0 ? emailsAdicionaisArray : null
        }])
        .select()
        .single()

      if (errorSolicitacao) {
        console.error('Erro ao criar solicitação:', errorSolicitacao)
        alert('Erro ao criar solicitação')
        return
      }

      // Inserir itens
      if (Object.keys(produtosImportados).length > 0) {
        const allItens: any[] = []
        Object.entries(produtosImportados).forEach(([categoria, prods]) => {
          (prods as Produto[]).forEach(p => {
            const colunasPadrao = new Set(["COD PRODUTO", "PRODUTO", "CATEGORIA", "QUANTIDADE CF", "DATA VENCIMENTO", "NUM_TRANSPORTE", "VALOR"])
            const extras = Object.keys(p)
              .filter(k => !colunasPadrao.has(k))
              .reduce((obj, key) => ({ ...obj, [key]: p[key] }), {})

            allItens.push({
              solicitacao_id: novaSolicitacao.id,
              categoria: categoria,
              cod_produto: p["COD PRODUTO"],
              produto: p.PRODUTO,
              quantidade_cf: p["QUANTIDADE CF"],
              data_vencimento: p["DATA VENCIMENTO"].split('/').reverse().join('-'), // converter para YYYY-MM-DD
              num_transporte: p["NUM_TRANSPORTE"]?.toString() || null,
              valor: p["VALOR"] ? parseFloat(p["VALOR"].toString()) : null,
              extras: extras
            })
          })
        })

        const { error: errorItens } = await supabase
          .from('itens_solicitacao')
          .insert(allItens)

        if (errorItens) {
          console.error('Erro ao inserir itens:', errorItens)
        }
      }

      const link = `${window.location.origin}/confirmacao/${novaSolicitacao.id}`
      setLinkGerado(link)
      fetchSolicitacoes()
    } catch (error) {
      console.error('Erro ao gerar link:', error)
      alert('Erro ao gerar link')
    } finally {
      setIsGenerating(false)
    }
  }, [nome, email, data, hora, emailsAdicionais, produtosImportados, fetchSolicitacoes])

  const enviarEmails = useCallback(async () => {
    if (!linkGerado || !email) {
      alert("Certifique-se de que o link foi gerado e o e-mail do destinatário está preenchido.")
      return
    }

    setIsSendingEmail(true)
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: email,
          subject: "Confirmação de Recebimento de Mercadoria - SOLAR Coca-Cola",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; padding: 20px;">
              <h2 style="color: #1a1a1a; margin-top: 0;">Olá, ${nome}!</h2>
              <p style="color: #444; line-height: 1.6;">Você tem uma nova solicitação de confirmação de recebimento de mercadoria.</p>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Entrega prevista:</strong> ${data} às ${hora}</p>
              </div>
              <p style="color: #444; line-height: 1.6;">Por favor, clique no botão abaixo para revisar e confirmar o recebimento:</p>
              <div style="margin: 30px 0; text-align: center;">
                <a href="${linkGerado}" style="background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Confirmar Recebimento
                </a>
              </div>
              <p style="color: #888; font-size: 13px; margin-top: 30px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
              <p style="color: #888; font-size: 13px; word-break: break-all;">${linkGerado}</p>
            </div>
          `,
        }),
      });

      if (response.ok) {
        setEmailEnviado(true);
        setTimeout(() => setEmailEnviado(false), 5000);
      } else {
        const errorData = await response.json();
        console.error("Erro ao enviar email:", errorData);
        alert(`Erro ao enviar email: ${errorData.error?.message || "Erro desconhecido"}`);
      }
    } catch (error) {
      console.error("Erro ao enviar email:", error);
      alert("Erro ao enviar email. Verifique sua conexão ou a configuração da API.");
    } finally {
      setIsSendingEmail(false)
    }
  }, [linkGerado, email, nome, data, hora])

  const excluirSolicitacao = useCallback((id: string) => {
    setSolicitacaoToDelete(id)
    setIsDeleteDialogOpen(true)
  }, [])

  const confirmarExclusao = useCallback(async () => {
    if (!solicitacaoToDelete) return
    
    const { error } = await supabase
      .from('solicitacoes')
      .delete()
      .eq('id', solicitacaoToDelete)

    if (error) {
      console.error('Erro ao excluir solicitação:', error)
      alert('Erro ao excluir solicitação')
      return
    }

    setIsDeleteDialogOpen(false)
    setSolicitacaoToDelete(null)
    fetchSolicitacoes()
  }, [solicitacaoToDelete, fetchSolicitacoes])

  const formatarData = (valor: string | number): string => {
    if (!valor) return ""
    if (typeof valor === "number") {
      const excelEpoch = new Date(1899, 11, 30)
      const date = new Date(excelEpoch.getTime() + valor * 86400000)
      return date.toLocaleDateString("pt-BR")
    }
    if (typeof valor === "string" && valor.includes("/")) return valor
    const date = new Date(valor)
    if (!isNaN(date.getTime())) return date.toLocaleDateString("pt-BR")
    return String(valor)
  }

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bytes = new Uint8Array(evt.target?.result as ArrayBuffer)
      const workbook = XLSX.read(bytes, { type: "array" })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json<Produto>(firstSheet)

      const categorias: Record<string, Produto[]> = {}
      jsonData.forEach((prod) => {
        const cat = (prod.CATEGORIA || "Sem Categoria").toString().toUpperCase()
        if (!categorias[cat]) categorias[cat] = []
        categorias[cat].push({
          ...prod,
          CATEGORIA: cat,
          PRODUTO: prod.PRODUTO?.toString().toUpperCase() || "",
          "COD PRODUTO": prod["COD PRODUTO"]?.toString().toUpperCase() || "",
          "DATA VENCIMENTO": formatarData(prod["DATA VENCIMENTO"]),
        })
      })

      Object.keys(categorias).forEach((cat) => {
        categorias[cat].sort((a, b) => {
          const parseDate = (dateStr: string) => {
            if (!dateStr) return new Date(9999, 11, 31)
            const parts = dateStr.split("/")
            if (parts.length === 3)
              return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
            return new Date(dateStr)
          }
          return parseDate(a["DATA VENCIMENTO"]).getTime() - parseDate(b["DATA VENCIMENTO"]).getTime()
        })
      })

      setProdutosImportados(categorias)
      const produtosTexto = jsonData
        .map((p) => `${p.PRODUTO?.toString().toUpperCase()} - ${p["QUANTIDADE CF"]} unidades`)
        .join("\n")
      setProdutos(produtosTexto)
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const downloadTemplate = useCallback(() => {
    const templateData = [
      {
        CATEGORIA: "CERVEJA",
        "COD PRODUTO": "123",
        PRODUTO: "SOL",
        "QUANTIDADE CF": 10,
        "DATA VENCIMENTO": "01/04/2026",
        NUM_TRANSPORTE: "12",
        VALOR: "150.00"
      }
    ]
    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Template")
    XLSX.writeFile(wb, "template_recebimento.xlsx")
  }, [])

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    switch (s) {
      case "pendente":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Pendente</Badge>
      case "confirmado":
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">Confirmado</Badge>
      case "recusado":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white">Recusado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const copiarLink = useCallback((id: string) => {
    const link = `${window.location.origin}/confirmacao/${id}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiadoId(id)
      setTimeout(() => setCopiadoId(null), 2000)
    })
  }, [])

  const compartilharLink = useCallback(async (id: string, destinatario: string) => {
    const url = `${window.location.origin}/confirmacao/${id}`
    const shareData = {
      title: 'Confirmação de Recebimento - SOLAR Coca-Cola',
      text: `Olá ${destinatario}, por favor confirme o recebimento da mercadoria através deste link:`,
      url: url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback to copy if share is not supported
        copiarLink(id);
        alert("Compartilhamento não suportado neste navegador. O link foi copiado para a área de transferência.");
      }
    } catch (err) {
      console.error('Erro ao compartilhar:', err);
    }
  }, [copiarLink])

  const colunasPadrao = new Set(["COD PRODUTO", "PRODUTO", "CATEGORIA", "QUANTIDADE CF", "DATA VENCIMENTO", "NUM_TRANSPORTE", "VALOR"])

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">

        <div className="sticky top-0 z-30 pb-2 pt-2 bg-muted/30 backdrop-blur-sm -mx-4 px-4 md:-mx-8 md:px-8">
          <Card className="shadow-sm border-b">
            <CardHeader className="py-3 md:py-4">
              <CardTitle className="text-xl md:text-2xl">Painel de Confirmação de Recebimento de Mercadoria</CardTitle>
              <CardDescription>Gerencie solicitações e confirme recebimentos de mercadoria</CardDescription>
            </CardHeader>
          </Card>
        </div>
   

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Criar nova solicitação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do destinatário</Label>
                <Input
                  id="nome"
                  placeholder="Nome do destinatário"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email do destinatário</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email do destinatário"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data da entrega</Label>
                <Input
                  id="data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hora">Hora da entrega</Label>
                <Input
                  id="hora"
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emails-adicionais">Emails adicionais (separados por vírgula) – Endereços receberão confirmação do destinatário.</Label>
              <Input
                id="emails-adicionais"
                placeholder="email1@exemplo.com, email2@exemplo.com"
                value={emailsAdicionais}
                onChange={(e) => setEmailsAdicionais(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="produtos">Lista de produtos (um por linha)</Label>
              <Textarea
                id="produtos"
                placeholder="Lista de produtos manual (opcional, um por linha)"
                value={produtos}
                onChange={(e) => setProdutos(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={gerarLink} 
                disabled={isGenerating}
                className="hover:bg-primary/80 hover:shadow-md transition-all duration-200 active:scale-95"
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Gerar Link de Confirmação
              </Button>
              <Button 
                variant="secondary" 
                onClick={enviarEmails} 
                disabled={!linkGerado || isSendingEmail}
                className="hover:bg-secondary/70 hover:shadow-sm transition-all duration-200 active:scale-95"
              >
                {isSendingEmail ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Enviar Email com Link
              </Button>
            </div>
            {emailEnviado && (
              <div className="rounded-lg bg-blue-50 p-4 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                <p className="font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  E-mails enviados com sucesso! (Simulação)
                </p>
              </div>
            )}
            {linkGerado && (
              <div className="rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-950 dark:text-green-200">
                <p className="font-medium">Link gerado com sucesso!</p>
                <a
                  href={linkGerado}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm underline hover:no-underline break-all"
                >
                  {linkGerado}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Solicitações Criadas</CardTitle>
          </CardHeader>
          <CardContent>
            {solicitacoes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma solicitação criada ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Entrega Prevista</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {solicitacoes.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(s.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-medium">{s.destinatario}</TableCell>
                        <TableCell>{s.email}</TableCell>
                        <TableCell>
                          {s.entrega_prevista ? new Date(s.entrega_prevista).toLocaleString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(s.status)}</TableCell>
                        <TableCell className="flex items-center gap-2">
                          <a
                            href={`/confirmacao/${s.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline text-sm"
                            title="Link de Confirmação"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <a
                            href={`/visualizar/${s.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                            title="Visualizar Status"
                          >
                            <Eye className="h-4 w-4" />
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copiarLink(s.id)}
                            className={`h-8 w-8 transition-colors ${copiadoId === s.id ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground hover:text-primary'}`}
                            title="Copiar Link"
                          >
                            {copiadoId === s.id ? (
                              <Badge className="absolute -top-8 right-0 bg-green-500 text-white animate-in fade-in slide-in-from-bottom-1 duration-200">
                                Copiado!
                              </Badge>
                            ) : null}
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => compartilharLink(s.id, s.destinatario)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                            title="Compartilhar Link"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => excluirSolicitacao(s.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Importar Planilha de Produtos
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Baixar Planilha Padrão
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                className="max-w-sm"
              />
              <Button
                variant="outline"
                onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Selecionar Arquivo
              </Button>
            </div>
            {Object.keys(produtosImportados).length > 0 && (
              <div className="space-y-6">
                <h4 className="font-semibold">Produtos Importados</h4>
                {Object.entries(produtosImportados).map(([categoria, prods]) => {
                  const colunasExtras = (prods as Produto[]).length > 0
                    ? Object.keys((prods as Produto[])[0]).filter((k) => !colunasPadrao.has(k))
                    : []
                  return (
                    <div key={categoria} className="space-y-2">
                      <h5 className="font-bold text-sm uppercase tracking-wide border-b pb-1">
                        {categoria}
                      </h5>
                      <div className="overflow-x-auto rounded-lg border">
                        <Table className="text-xs">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="py-2 text-xs">Código</TableHead>
                              <TableHead className="py-2 text-xs">Produto</TableHead>
                              <TableHead className="py-2 text-xs text-right">Qtd CXF</TableHead>
                              <TableHead className="py-2 text-xs">Data Vencimento</TableHead>
                              <TableHead className="py-2 text-xs">Transporte</TableHead>
                              <TableHead className="py-2 text-xs">Valor</TableHead>
                              {colunasExtras.map((col) => (
                                <TableHead key={col} className="py-2 text-xs">{col}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(prods as Produto[]).map((p, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="py-1.5 font-mono text-xs">{p["COD PRODUTO"]}</TableCell>
                                <TableCell className="py-1.5 text-xs">{p.PRODUTO}</TableCell>
                                <TableCell className="py-1.5 text-xs text-right">{p["QUANTIDADE CF"]}</TableCell>
                                <TableCell className="py-1.5 text-xs">{p["DATA VENCIMENTO"]}</TableCell>
                                <TableCell className="py-1.5 text-xs">{p["NUM_TRANSPORTE"] ?? ""}</TableCell>
                                <TableCell className="py-1.5 text-xs">{p["VALOR"] ?? ""}</TableCell>
                                {colunasExtras.map((col) => (
                                  <TableCell key={col} className="py-1.5 text-xs">{p[col] ?? ""}</TableCell>
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
            )}
          </CardContent>
        </Card>

        <Dialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          title="Confirmar Exclusão"
        >
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Tem certeza que deseja excluir esta solicitação? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteDialogOpen(false)}
                className="hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmarExclusao}
                className="hover:bg-red-700 transition-colors"
              >
                Excluir
              </Button>
            </div>
          </div>
        </Dialog>

      </div>
    </div>
  )
}
