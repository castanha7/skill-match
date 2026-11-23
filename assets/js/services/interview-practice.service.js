const QUESTION_BANK = {
  "Jovem Aprendiz": [
    { id: "apprentice-intro", question: "Conte um pouco sobre você e o que gostaria de aprender em um programa Jovem Aprendiz." },
    { id: "apprentice-routine", question: "Como você se organizaria para conciliar estudos, horários e responsabilidades no trabalho?" },
    { id: "apprentice-teamwork", question: "Conte sobre uma atividade escolar ou em grupo em que você colaborou com outras pessoas." },
  ],
  "Estágio": [
    { id: "internship-project", question: "Fale sobre um projeto escolar ou atividade em que aplicou algo que está aprendendo." },
    { id: "internship-learning", question: "Como você costuma agir quando recebe uma tarefa que ainda não sabe realizar?" },
    { id: "internship-goals", question: "O que você espera aprender e contribuir durante este estágio?" },
  ],
  "Primeiro Emprego": [
    { id: "first-job-intro", question: "Conte um pouco sobre você e por que esta oportunidade chamou sua atenção." },
    { id: "first-job-example", question: "Dê um exemplo de uma situação em que demonstrou responsabilidade ou iniciativa." },
    { id: "first-job-challenge", question: "Como você pediria orientação ao encontrar um desafio novo no trabalho?" },
  ],
  default: [
    { id: "general-intro", question: "Conte um pouco sobre você, seus interesses e o tipo de oportunidade que procura." },
    { id: "general-example", question: "Fale sobre uma atividade em que precisou aprender algo novo ou colaborar com alguém." },
  ],
};

function normalize(value) {
  return String(value ?? "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export const InterviewPracticeService = {
  questionsFor(jobType) {
    const questions = QUESTION_BANK[jobType] || QUESTION_BANK.default;
    return questions.map((question) => ({ ...question }));
  },

  /** Feedback guiado por verificações explícitas; não é IA nem avaliação de aptidão. */
  reviewAnswer({ answer, candidate = {} }) {
    const text = String(answer ?? "").trim();
    const words = text ? text.split(/\s+/).filter(Boolean) : [];
    const sentences = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
    const normalizedAnswer = normalize(text);
    const concreteExample = /\b(por exemplo|projeto|trabalho em grupo|atividade escolar|na escola|voluntari|organizei|desenvolvi|participei)\b/.test(normalizedAnswer);
    const mentionedSkills = (candidate.habilidades || [])
      .filter((skill) => normalize(skill).length >= 3 && normalizedAnswer.includes(normalize(skill)))
      .slice(0, 4);
    const observations = [
      {
        label: "Clareza",
        text: words.length >= 20
          ? `Sua resposta tem ${words.length} palavras; confira se a ideia principal aparece logo no início.`
          : `Sua resposta tem ${words.length} palavra(s); experimente acrescentar contexto e uma ação concreta.`,
      },
      {
        label: "Objetividade",
        text: sentences.length > 4
          ? `Há ${sentences.length} frases. Revise se cada uma contribui para responder à pergunta.`
          : "A resposta tem até quatro frases; confira se cada uma contribui para responder à pergunta.",
      },
      {
        label: "Exemplo concreto",
        text: concreteExample
          ? "Há uma referência a exemplo, projeto ou atividade. Explique qual foi sua participação."
          : "Não identificamos uma referência explícita a exemplo ou projeto; inclua uma situação real sua, se houver.",
      },
      {
        label: "Habilidades do perfil",
        text: mentionedSkills.length
          ? `Você relacionou a resposta a: ${mentionedSkills.join(", ")}.`
          : "Não identificamos habilidades do seu perfil na resposta. Você pode relacionar uma habilidade real à pergunta.",
      },
    ];
    const improvements = [];
    if (words.length < 20) improvements.push("Acrescente um pouco de contexto: qual era a situação ou objetivo?");
    if (!concreteExample) improvements.push("Se puder, use um exemplo verdadeiro de estudo, projeto, atividade ou rotina — não precisa ter experiência formal.");
    if (!mentionedSkills.length) improvements.push("Explique qual habilidade sua ajudou e como você a desenvolveu.");
    if (sentences.length > 4) improvements.push("Considere resumir em poucas etapas para facilitar o acompanhamento.");
    if (!improvements.length) improvements.push("Revise se a resposta está ligada à pergunta e encerre com o que aprendeu ou deseja desenvolver.");
    return {
      observations,
      improvements,
      answerStructure: "Contexto ou objetivo → o que você fez → resultado ou aprendizado → relação com a oportunidade.",
      disclaimer: "Revisão demonstrativa por regras simples de extensão e palavras-chave. Não é inteligência artificial, não mede aptidão e não determina contratação.",
      wordCount: words.length,
    };
  },
};
