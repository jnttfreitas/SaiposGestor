// ZAF SDK Inicialização Framework ZCLI
const client = ZAFClient.init();
client.invoke('resize', { width: '100%', height: '600px' }); // Ajuste da altura para acomodar todos os elementos

// IDs dos campos personalizados
const CONTACT_REASON_FIELD_ID = "19911967728916";
const SOLUTION_REASON_FIELD_ID = "19912059302804";

let ViewID, Tag, ObsInterna; // Declaração das variáveis de configuração

// Função para carregar formulários de tickets
async function loadTicketForms() {
    try {
        const response = await client.request('/api/v2/ticket_forms.json');
        const ticketFormSelect = document.getElementById('ticketForm');
        response.ticket_forms.forEach(form => {
            const option = document.createElement('option');
            option.value = form.id;
            option.textContent = form.name;
            ticketFormSelect.appendChild(option);

            // Pré-seleção do formulário "Suporte | Chat"
            if (form.name === "Suporte | Chat") {
                ticketFormSelect.value = form.id;
            }
        });
    } catch (error) {
        console.error('Erro ao carregar formulários:', error);
    }
}

// Função para carregar opções de campos personalizados
async function loadCustomFieldOptions(fieldId, selectElementId, predefinedValue) {
    try {
        const response = await client.request(`/api/v2/ticket_fields/${fieldId}.json`);
        const selectElement = document.getElementById(selectElementId);
        response.ticket_field.custom_field_options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.name;
            selectElement.appendChild(optionElement);

            // Pré-seleção das opções usando o valor correto
            if (option.value === predefinedValue) {
                selectElement.value = option.value;
            }
        });
    } catch (error) {
        console.error(`Erro ao carregar opções para o campo ${fieldId}:`, error);
    }
}

// Função para atualizar contagens de tickets
async function atualizarContagens() {
    if (!ViewID) {
        console.error("ViewID não está definido. Verifique as configurações.");
        return;
    }

    const filtroMinutos = parseInt(document.getElementById('filterTime').value, 10); // Obtém o tempo selecionado
    document.getElementById('selectedFilterTime').textContent = filtroMinutos; // Atualiza o span no HTML
    console.log(`Aplicando filtro para tickets há mais de ${filtroMinutos} minutos`);

    try {
        const response = await client.request(`/api/v2/views/${ViewID}/count.json`);
        if (response?.view_count?.value !== undefined) {
            document.getElementById("totalTickets").textContent = response.view_count.value;
        } else {
            console.error("Contagem de tickets não encontrada na resposta.");
        }

        const ticketsResponse = await client.request(`/api/v2/views/${ViewID}/tickets.json`);
        const waitingTickets = ticketsResponse.tickets.filter(ticket => {
            const createdAt = new Date(ticket.created_at); // Data de criação do ticket
            const agora = new Date(); // Data atual

            const diffMinutos = Math.floor((agora - createdAt) / 60000); // Diferença em minutos
            
            return diffMinutos >= filtroMinutos && ticket.status === 'new';
        });

        console.log(`Tickets encontrados após filtro: ${waitingTickets.length}`, waitingTickets);
        document.getElementById("waitingTickets").textContent = waitingTickets.length;
    } catch (erro) {
        console.error("Erro ao atualizar contagens de tickets:", erro);
    }
}

// Adiciona evento ao botão "Aplicar Filtro"
document.getElementById('applyFilterButton').addEventListener('click', atualizarContagens);

// Garante que a contagem seja carregada ao iniciar
document.addEventListener('DOMContentLoaded', () => {
    client.metadata().then((metadata) => {
        ({ ViewID, Tag, ObsInterna } = metadata.settings);

        // Definições padrão
        document.getElementById('ticketType').value = "question";
        loadTicketForms();
        loadCustomFieldOptions(CONTACT_REASON_FIELD_ID, 'contactReason', "atendimento__abandono_");
        loadCustomFieldOptions(SOLUTION_REASON_FIELD_ID, 'solutionReason', "não_resolvido_abandono_de_chat");

        atualizarContagens(); // Chama a função logo no início para garantir atualização
    }).catch(error => {
        console.error("Erro ao obter configurações do aplicativo:", error);
    });
});

// Função para atribuir tickets e configurar os campos
async function atribuirTickets() {
    try {
        const userResponse = await client.get('currentUser');
        const currentUser = userResponse.currentUser;
        if (!currentUser?.id) {
            console.error("ID do usuário atual não encontrado.");
            return;
        }

        const filtroMinutos = parseInt(document.getElementById('filterTime').value, 10);
        const ticketType = document.getElementById('ticketType').value;
        const ticketForm = document.getElementById('ticketForm').value;
        const contactReason = document.getElementById('contactReason').value;
        const solutionReason = document.getElementById('solutionReason').value;
        const additionalTag = document.getElementById('additionalTag').value.trim(); // Nova tag opcional

        const ticketsResponse = await client.request(`/api/v2/views/${ViewID}/tickets.json`);
        const ticketsParaAtribuir = ticketsResponse.tickets.filter(ticket => {
            const createdAt = new Date(ticket.created_at);
            const agora = new Date();
            const diffMinutos = Math.floor((agora - createdAt) / 60000);
            return diffMinutos >= filtroMinutos && ticket.status === 'new';
        });

        for (const ticket of ticketsParaAtribuir) {
            let tags = [...ticket.tags, Tag];
            if (additionalTag) {
                tags.push(additionalTag);
            }

            await client.request({
                url: `/api/v2/tickets/${ticket.id}.json`,
                type: "PUT",
                contentType: "application/json",
                data: JSON.stringify({
                    ticket: {
                        type: ticketType,
                        form_id: ticketForm || null,
                        custom_fields: [
                            { id: CONTACT_REASON_FIELD_ID, value: contactReason || null },
                            { id: SOLUTION_REASON_FIELD_ID, value: solutionReason || null }
                        ],
                        assignee_id: currentUser.id,
                        tags: tags,
                        comment: {
                            body: ObsInterna || "",
                            public: false
                        }
                    }
                })
            });
            console.log(`Ticket ${ticket.id} atribuído com tag adicional opcional ${additionalTag || "Nenhuma"}`);
        }

        atualizarContagens();
    } catch (erro) {
        console.error("Erro ao atribuir tickets:", erro);
    }
}


// Evento para botão de recarregar com animação
document.getElementById('reloadButton').addEventListener('click', () => {
    const animationFrame = document.getElementById('animationFrame');
  
    // Mostrar o iframe
    animationFrame.style.display = 'block';
  
    // Carregar a animação dentro do iframe
    animationFrame.srcdoc = `
      <html>
        <head>
          <style>
            body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: white; }
            gif { width: 80%; height: 80%; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="allen_animation.gif" />
        </body>
      </html>
    `;
  
    // Recarregar após a duração do vídeo (ajuste o tempo conforme necessário)
    setTimeout(() => location.reload(), 3000);
  });

// Evento para botão de atribuição de tickets
document.getElementById('assignButton').addEventListener('click', () => {
    const animationFrame = document.getElementById('animationFrame');
  
    // Mostrar o iframe
    animationFrame.style.display = 'block';
  
    // Carregar a animação dentro do iframe
    animationFrame.srcdoc = `
      <html>
        <head>
          <style>
            body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: white; }
            img { width: 80%; height: 80%; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="allen_animation.gif" />
        </body>
      </html>
    `;

    // Chamar a função de atribuir tickets imediatamente
    atribuirTickets();

    // Manter a animação visível por 3 segundos antes de esconder
    setTimeout(() => {
        animationFrame.style.display = 'none';
    }, 3000);
});

// Inicializa o carregamento de listas suspensas e contagens ao carregar o app
document.addEventListener('DOMContentLoaded', () => {
    client.metadata().then((metadata) => {
        ({ ViewID, Tag, ObsInterna } = metadata.settings); // Definição das configurações

        // Pré-seleção de valores fixos
        document.getElementById('ticketType').value = "question"; // Pré-seleção do tipo "Pergunta"
        loadTicketForms();
        
        // Use os valores `value` corretos das opções
        loadCustomFieldOptions(CONTACT_REASON_FIELD_ID, 'contactReason', "atendimento__abandono_");
        loadCustomFieldOptions(SOLUTION_REASON_FIELD_ID, 'solutionReason', "não_resolvido_abandono_de_chat");
        atualizarContagens();
    }).catch(error => {
        console.error("Erro ao obter configurações do aplicativo:", error);
    });
});
