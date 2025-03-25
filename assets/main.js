// ZAF SDK Inicialização Framework ZCLI
const client = ZAFClient.init();
client.invoke('resize', { width: '100%', height: '480px' }); // Ajuste da altura para acomodar todos os elementos

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
    try {
        const response = await client.request(`/api/v2/views/${ViewID}/count.json`);
        if (response?.view_count?.value !== undefined) {
            document.getElementById("totalTickets").textContent = response.view_count.value;
        } else {
            console.error("Contagem de tickets não encontrada na resposta.");
        }

        const ticketsResponse = await client.request(`/api/v2/views/${ViewID}/tickets.json`);
        const waitingTickets = ticketsResponse.tickets.filter(ticket => {
            const createdAt = new Date(ticket.created_at);
            const agora = new Date();
            return ((agora - createdAt) / 60000) > 10 && ticket.status === 'new';
        });
        document.getElementById("waitingTickets").textContent = waitingTickets.length;
    } catch (erro) {
        console.error("Erro ao atualizar contagens de tickets:", erro);
    }
}

// Função para atribuir tickets e configurar os campos
async function atribuirTickets() {
    try {
        const userResponse = await client.get('currentUser');
        const currentUser = userResponse.currentUser;
        if (!currentUser?.id) {
            console.error("ID do usuário atual não encontrado.");
            return;
        }

        const ticketType = document.getElementById('ticketType').value;
        const ticketForm = document.getElementById('ticketForm').value;
        const contactReason = document.getElementById('contactReason').value;
        const solutionReason = document.getElementById('solutionReason').value;

        const ticketsResponse = await client.request(`/api/v2/views/${ViewID}/tickets.json`);
        const ticketsParaAtribuir = ticketsResponse.tickets.filter(ticket => {
            const createdAt = new Date(ticket.created_at);
            const agora = new Date();
            return ((agora - createdAt) / 60000) > 10 && ticket.status === 'new';
        });

        for (const ticket of ticketsParaAtribuir) {
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
                        tags: [...ticket.tags, Tag],
                        comment: {
                            body: ObsInterna || "",
                            public: false
                        }
                    }
                })
            });
            console.log(`Ticket ${ticket.id} atribuído e configurado.`);
        }
        atualizarContagens();
    } catch (erro) {
        console.error("Erro ao atribuir tickets:", erro);
    }
}

// Evento para botão de recarregar com animação
document.getElementById('reloadButton').addEventListener('click', () => {
  const reloadButton = document.getElementById('reloadButton');
  reloadButton.classList.add('spin-animation');
  
  // Remove a classe de animação após 1 segundo (tempo da animação)
  setTimeout(() => reloadButton.classList.remove('spin-animation'), 1000);
  
  location.reload();
});

// Evento para botão de atribuição de tickets
document.getElementById("assignButton").addEventListener("click", atribuirTickets);

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
