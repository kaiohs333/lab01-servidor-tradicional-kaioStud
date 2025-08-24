# Laboratório 1: Servidor de Aplicação Tradicional

**Laboratório de Desenvolvimento de Aplicações Móveis e Distribuídas**
**Curso de Engenharia de Software - PUC Minas**

Este projeto implementa um servidor de aplicação monolítico tradicional para um sistema de gerenciamento de tarefas (To-Do List), utilizando Node.js e Express. O objetivo é demonstrar os fundamentos da arquitetura cliente-servidor, a implementação de uma API REST completa e servir como base de comparação para arquiteturas distribuídas mais avançadas.

---

## Funcionalidades Implementadas

* **API REST Completa:** Operações CRUD (Criar, Ler, Atualizar, Deletar) para usuários e tarefas.
* **Autenticação com JWT:** Sistema de registro e login seguro utilizando JSON Web Tokens.
* **Validação de Dados:** Validação robusta de payloads de entrada com a biblioteca Joi.
* **Paginação:** Suporte a paginação na listagem de tarefas para melhor performance.
* **Cache em Memória:** Cache para requisições frequentes, diminuindo a carga no banco de dados.
* **Logs Estruturados:** Sistema de logging profissional com Pino para monitoramento.
* **Rate Limiting:** Limites de requisição por IP (geral) e por usuário (em rotas autenticadas).
* **Filtros Avançados:** Filtragem de tarefas por status, prioridade, categoria, tags e intervalo de datas.

---

## Tecnologias Utilizadas

* **Backend:** Node.js, Express.js
* **Banco de Dados:** SQLite 3
* **Autenticação:** JWT (jsonwebtoken), bcryptjs
* **Segurança:** Helmet, express-rate-limit
* **Outras Ferramentas:** Nodemon, Pino (Logger), Joi (Validação), Node-Cache, Artillery (Testes)

---

## Instalação e Execução

### Pré-requisitos
* Node.js v16+
* NPM

### Passos para Instalação

1.  Clone este repositório.
2.  Navegue até a pasta do projeto.
3.  Instale as dependências: `npm install`

### Executando o Servidor

* Para iniciar em modo de desenvolvimento (com reinicialização automática):
    ```bash
    npm run dev
    ```

* Para iniciar em modo de produção:
    ```bash
    npm start
    ```
O servidor estará disponível em `http://localhost:3000`.

---

## Documentação da API

### Autenticação

#### `POST /api/auth/register`
Registra um novo usuário.
* **Requer Autenticação:** Não
* **Corpo da Requisição (Body):**
    ```json
    {
        "email": "user@example.com",
        "username": "testuser",
        "password": "password123",
        "firstName": "Test",
        "lastName": "User"
    }
    ```

#### `POST /api/auth/login`
Autentica um usuário e retorna um token JWT.
* **Requer Autenticação:** Não
* **Corpo da Requisição (Body):**
    ```json
    {
        "identifier": "user@example.com",
        "password": "password123"
    }
    ```

### Tarefas

_Todas as rotas de tarefas requerem um token JWT no cabeçalho `Authorization: Bearer <seu-token>`._

#### `POST /api/tasks`
Cria uma nova tarefa.
* **Requer Autenticação:** Sim
* **Corpo da Requisição (Body):**
    ```json
    {
        "title": "Minha Nova Tarefa",
        "description": "Descrição opcional da tarefa.",
        "priority": "medium",
        "category": "Trabalho",
        "tags": "importante, relatorio"
    }
    ```

#### `GET /api/tasks`
Lista as tarefas do usuário com filtros e paginação.
* **Requer Autenticação:** Sim
* **Parâmetros de Query (Opcionais):**
    * `page` (número, padrão: 1)
    * `limit` (número, padrão: 10)
    * `completed` (booleano: `true` ou `false`)
    * `priority` (string: `low`, `medium`, `high`, `urgent`)
    * `category` (string)
    * `tags` (string, busca parcial)
    * `startDate` (data, formato: `YYYY-MM-DD`)
    * `endDate` (data, formato: `YYYY-MM-DD`)
* **Exemplo:** `GET /api/tasks?page=1&limit=5&category=Trabalho`

#### `GET /api/tasks/:id`
Busca uma tarefa específica por seu ID.
* **Requer Autenticação:** Sim

#### `PUT /api/tasks/:id`
Atualiza uma tarefa existente.
* **Requer Autenticação:** Sim
* **Corpo da Requisição (Body):** Mesmo formato da criação de tarefa.

#### `DELETE /api/tasks/:id`
Deleta uma tarefa.
* **Requer Autenticação:** Sim

#### `GET /api/tasks/stats/summary`
Retorna estatísticas sobre as tarefas do usuário.
* **Requer Autenticação:** Sim

---

## Análise da Arquitetura e Performance

A análise a seguir resume as características e limitações da arquitetura monolítica implementada, com base na teoria de sistemas distribuídos e nos resultados de um teste de estresse realizado com a ferramenta Artillery.

### Performance: Onde estão os possíveis gargalos do sistema?

O teste de estresse revelou que o sistema não suporta alta carga, com o **banco de dados SQLite** sendo o principal gargalo. O acesso concorrente ao arquivo do banco causa longos tempos de resposta e timeouts. Outros gargalos incluem operações de uso intensivo de CPU (como `bcrypt`) e o consumo de memória pelo cache.

### Escalabilidade: Como esta arquitetura se comportaria com 1000 usuários simultâneos?

A arquitetura falharia completamente. O teste com 300 usuários virtuais já causou a falha do sistema. Com 1000 usuários, o gargalo no banco de dados e a natureza single-threaded do Node.js levariam à indisponibilidade total do serviço. A única opção de escalabilidade é a vertical (mais hardware), que é limitada e cara.

### Disponibilidade: Quais são os pontos de falha identificados?

O sistema possui dois Pontos Únicos de Falha (SPOF):
* **O Processo do Servidor:** Se a aplicação Node.js travar, o serviço todo fica indisponível.
* **O Banco de Dados:** Uma falha ou corrupção no arquivo `tasks.db` paralisa todo o sistema.

### Manutenção: Como seria o processo de atualização em produção?

A atualização exige **downtime**. O processo consiste em parar o servidor, substituir os arquivos de código e reiniciar o serviço. Durante este período, a aplicação fica totalmente indisponível para os usuários.

### Evolução: Que mudanças seriam necessárias para suportar múltiplas regiões?

A arquitetura atual é inadequada para operar em múltiplas regiões. Seriam necessárias mudanças drásticas:
* **Múltiplas Instâncias da Aplicação:** Uma em cada região.
* **Balanceador de Carga Global:** Para direcionar o tráfego para a instância mais próxima do usuário.
* **Banco de Dados Distribuído:** Substituir o SQLite por um sistema que suporte replicação de dados entre as regiões para garantir consistência e performance.