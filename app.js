const questionBank = [
  {
    topic: "Sources officielles",
    question: "Pour réviser une règle susceptible d’avoir évolué, quelle est la meilleure démarche ?",
    options: ["Se fier à une capture d’écran partagée sur un réseau social", "Consulter les documents officiels en vigueur et vérifier leur date", "Utiliser uniquement ses notes les plus anciennes"],
    answer: 1,
    explanation: "Vérifiez la version et la date des textes et instructions officiels applicables à votre session."
  },
  {
    topic: "Préparation à l’examen",
    question: "Une préparation privée peut-elle garantir la réussite à l’examen ou l’obtention d’une licence ?",
    options: ["Oui, si toutes les séances sont suivies", "Oui, si l’on suit une méthode secrète", "Non : elle peut accompagner les révisions, sans garantir de résultat"],
    answer: 2,
    explanation: "Aucune préparation privée ne peut garantir la réussite à un examen ou l’obtention d’une licence."
  },
  {
    topic: "Interprétation des textes",
    question: "Vous n’êtes pas certain de l’interprétation d’une règle. Quel réflexe adopter ?",
    options: ["Présenter votre supposition comme une règle certaine", "Vérifier le texte applicable et signaler clairement toute incertitude", "Répéter la réponse la plus populaire dans un groupe de discussion"],
    answer: 1,
    explanation: "Vérifiez la source applicable et distinguez les faits confirmés des points qui nécessitent clarification."
  },
  {
    topic: "Communication professionnelle",
    question: "Comment présenter une académie privée de préparation ?",
    options: ["Comme un organisme indépendant, sans laisser croire à une approbation officielle", "Comme un centre FIFA, même sans autorisation", "Comme une garantie d’accès à la profession"],
    answer: 0,
    explanation: "La communication doit distinguer clairement un service privé d’un organisme officiel."
  },
  {
    topic: "Protection des données",
    question: "Un dossier de préparation contient des informations personnelles. Quelle pratique est la plus prudente ?",
    options: ["Le partager avec tout le groupe", "Le publier en ligne en retirant seulement le nom", "Limiter l’accès aux personnes qui en ont besoin et éviter les partages non autorisés"],
    answer: 2,
    explanation: "Limitez l’accès aux informations personnelles et ne les partagez pas sans raison valable ni autorisation."
  },
  {
    topic: "Sources officielles",
    question: "Vous trouvez deux versions différentes d’une règle dans des documents en ligne. Que faire ?",
    options: ["Choisir la version la plus courte", "Comparer la date, la source et le champ d’application des documents officiels", "Prendre la version publiée dans le premier résultat de recherche"],
    answer: 1,
    explanation: "La date et la source sont essentielles. Référez-vous aux publications officielles applicables à l’examen concerné."
  },
  {
    topic: "Mandats et représentation",
    question: "Avant de conseiller une personne sur un accord de représentation, quel principe de préparation est le plus fiable ?",
    options: ["Vérifier les exigences actuelles et les textes applicables plutôt que réutiliser un modèle non vérifié", "Utiliser n’importe quel modèle trouvé en ligne", "Promettre que l’accord garantit un transfert"],
    answer: 0,
    explanation: "Les documents et obligations doivent être vérifiés au regard des règles en vigueur et de la situation concernée."
  },
  {
    topic: "Conflits d’intérêts",
    question: "Une situation pourrait créer un conflit d’intérêts. Quel est le bon réflexe d’étude ?",
    options: ["L’ignorer tant qu’aucune personne ne pose de question", "Vérifier les règles applicables et demander un avis qualifié si nécessaire", "Supposer que toutes les situations sont autorisées"],
    answer: 1,
    explanation: "Ne tirez pas de conclusion automatique : vérifiez les règles applicables et faites clarifier les situations sensibles."
  },
  {
    topic: "Protection des mineurs",
    question: "Une question de représentation concerne un mineur. Quelle approche est la plus responsable ?",
    options: ["Appliquer les mêmes suppositions que pour tout autre dossier", "S’appuyer sur un conseil trouvé sur les réseaux sociaux", "Vérifier spécifiquement les règles actuelles et les protections applicables aux mineurs"],
    answer: 2,
    explanation: "Les situations impliquant des mineurs exigent une vérification attentive des règles et protections en vigueur."
  },
  {
    topic: "Réglementation et droit national",
    question: "Pour une activité transfrontalière, quelle préparation est la plus prudente ?",
    options: ["Considérer qu’une seule règle résout toutes les questions", "Vérifier les règles sportives applicables et les exigences nationales pertinentes", "Se fier uniquement aux pratiques d’un autre pays"],
    answer: 1,
    explanation: "Les règles sportives et les exigences nationales peuvent toutes deux être pertinentes ; vérifiez les sources applicables."
  },
  {
    topic: "Méthode de révision",
    question: "Comment consolider efficacement un thème réglementaire complexe ?",
    options: ["Relire une fois sans vérifier sa compréhension", "Mémoriser une réponse sans connaître la source", "Repérer les notions, consulter le texte, puis s’entraîner et revoir ses erreurs"],
    answer: 2,
    explanation: "Une révision active associe compréhension des sources, pratique et retour sur les erreurs."
  },
  {
    topic: "Communication professionnelle",
    question: "Un étudiant vous demande si une information de votre support est encore à jour. Que répondre ?",
    options: ["Lui indiquer la référence et la date de vérification, puis l’inviter à confirmer la version officielle", "Affirmer que tout support reste valable sans limite", "Éviter de préciser la source"],
    answer: 0,
    explanation: "Indiquez les références et dates de vérification ; les documents officiels en vigueur restent prioritaires."
  }
];

const EXAM_QUESTION_COUNT = 10;
const EXAM_DURATION_SECONDS = 10 * 60;
const form = document.querySelector("#quiz-form");
const questionLabel = document.querySelector("#quiz-question");
const optionsContainer = document.querySelector("#quiz-options");
const feedback = document.querySelector("#quiz-feedback");
const submitButton = document.querySelector("#quiz-submit");
const nextButton = document.querySelector("#quiz-next");
const startButton = document.querySelector("#quiz-start");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const modeNote = document.querySelector("#quiz-mode-note");
const progressLabel = document.querySelector("#quiz-progress-label");
const scoreLabel = document.querySelector("#quiz-score-label");
const timerLabel = document.querySelector("#quiz-timer");
const progressBar = document.querySelector("#quiz-progress");
const progressFill = document.querySelector("#quiz-progress-fill");
const result = document.querySelector("#quiz-result");
const review = document.querySelector("#quiz-review");
const registrationForm = document.querySelector("#registration-form");
const registrationStatus = document.querySelector("#registration-status");
const registrationSubmit = document.querySelector("#registration-submit");

let mode = "practice";
let sessionQuestions = [];
let currentQuestion = 0;
let score = 0;
let answered = false;
let selectedAnswers = [];
let timerId;
let deadline;

if (registrationForm) {
  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    registrationStatus.textContent = "";
    registrationStatus.className = "registration-status";
    registrationSubmit.disabled = true;

    try {
      const formData = new FormData(registrationForm);
      const response = await fetch("/api/inscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          consent: formData.get("consent") === "on",
          website: formData.get("website")
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "La demande n’a pas pu être envoyée.");

      registrationForm.reset();
      registrationStatus.textContent = "Votre demande a bien été reçue et sera examinée manuellement. Vous serez recontacté(e) au sujet de votre demande ; aucun compte étudiant n’est créé automatiquement.";
      registrationStatus.classList.add("is-success");
    } catch (error) {
      registrationStatus.textContent = error.message || "Impossible d’envoyer votre demande. Réessayez plus tard.";
      registrationStatus.classList.add("is-error");
    } finally {
      registrationSubmit.disabled = false;
    }
  });
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function updateProgress() {
  const total = sessionQuestions.length;
  const completed = mode === "timed"
    ? selectedAnswers.filter((answer) => answer !== null).length
    : currentQuestion + (answered ? 1 : 0);
  progressLabel.textContent = `Question ${Math.min(currentQuestion + 1, total)} sur ${total}`;
  progressBar.setAttribute("aria-valuemax", String(total));
  progressBar.setAttribute("aria-valuenow", String(completed));
  progressFill.style.width = `${(completed / total) * 100}%`;
}

function renderQuestion() {
  const item = sessionQuestions[currentQuestion];
  if (!item) return;
  answered = false;
  updateProgress();
  scoreLabel.textContent = mode === "practice" ? `Score : ${score}` : "Examen blanc";
  questionLabel.textContent = item.question;
  optionsContainer.replaceChildren();

  item.options.forEach((option, index) => {
    const label = document.createElement("label");
    label.className = "quiz-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "quiz-answer";
    input.value = String(index);
    input.required = true;
    const text = document.createElement("span");
    text.textContent = option;
    label.append(input, text);
    optionsContainer.append(label);
  });

  feedback.hidden = true;
  feedback.textContent = "";
  submitButton.hidden = false;
  nextButton.hidden = true;
  form.hidden = false;
}

function showQuestionReview() {
  review.replaceChildren();
  sessionQuestions.forEach((item, index) => {
    const entry = document.createElement("article");
    entry.className = "review-entry";
    const heading = document.createElement("h4");
    heading.textContent = `${index + 1}. ${item.topic}`;
    const question = document.createElement("p");
    question.textContent = item.question;
    const answerText = selectedAnswers[index] === item.answer
      ? `Votre réponse : ${item.options[item.answer]}`
      : `Réponse correcte : ${item.options[item.answer]}`;
    const answer = document.createElement("p");
    answer.className = selectedAnswers[index] === item.answer ? "review-correct" : "review-incorrect";
    answer.textContent = selectedAnswers[index] === null ? `Non répondu. ${answerText}` : answerText;
    const explanation = document.createElement("p");
    explanation.textContent = item.explanation;
    entry.append(heading, question, answer, explanation);
    review.append(entry);
  });
  review.hidden = false;
}

function finishSession(expired = false) {
  window.clearInterval(timerId);
  timerId = undefined;
  form.hidden = true;
  feedback.hidden = true;
  startButton.hidden = true;
  modeButtons.forEach((button) => { button.disabled = true; });
  progressLabel.textContent = expired ? "Temps écoulé" : "Entraînement terminé";
  scoreLabel.textContent = `Score : ${score} sur ${sessionQuestions.length}`;
  progressBar.setAttribute("aria-valuenow", String(sessionQuestions.length));
  progressFill.style.width = "100%";
  result.textContent = `${expired ? "Temps écoulé. " : ""}Votre score : ${score} sur ${sessionQuestions.length}. ${score === sessionQuestions.length ? "Excellent travail !" : "Consultez les corrections et les documents officiels en vigueur."}`;
  result.hidden = false;
  nextButton.hidden = true;
  showQuestionReview();
  const restart = document.createElement("button");
  restart.type = "button";
  restart.className = "quiz-next";
  restart.textContent = "Recommencer";
  restart.addEventListener("click", resetQuiz);
  review.append(restart);
}

function updateTimer() {
  const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  timerLabel.textContent = `Temps restant : ${minutes}:${String(seconds).padStart(2, "0")}`;
  timerLabel.classList.toggle("timer-warning", remaining <= 60);
  if (remaining === 0) finishSession(true);
}

function resetQuiz() {
  window.clearInterval(timerId);
  timerId = undefined;
  currentQuestion = 0;
  score = 0;
  answered = false;
  selectedAnswers = [];
  sessionQuestions = [];
  form.hidden = true;
  feedback.hidden = true;
  result.hidden = true;
  review.hidden = true;
  progressBar.hidden = true;
  document.querySelector("#quiz-topline").hidden = true;
  timerLabel.hidden = true;
  startButton.hidden = false;
  startButton.textContent = "Commencer l’entraînement →";
  modeButtons.forEach((button) => { button.disabled = false; });
}

function startSession() {
  modeButtons.forEach((button) => { button.disabled = true; });
  sessionQuestions = mode === "timed"
    ? shuffle([...questionBank]).slice(0, EXAM_QUESTION_COUNT)
    : [...questionBank];
  selectedAnswers = Array(sessionQuestions.length).fill(null);
  currentQuestion = 0;
  score = 0;
  result.hidden = true;
  review.hidden = true;
  startButton.hidden = true;
  document.querySelector("#quiz-topline").hidden = false;
  progressBar.hidden = false;
  timerLabel.hidden = mode !== "timed";
  renderQuestion();
  questionLabel.focus();

  if (mode === "timed") {
    deadline = Date.now() + EXAM_DURATION_SECONDS * 1000;
    updateTimer();
    timerId = window.setInterval(updateTimer, 1000);
  }
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (timerId || startButton.hidden) return;
    mode = button.dataset.mode;
    modeButtons.forEach((option) => {
      const active = option === button;
      option.classList.toggle("active", active);
      option.setAttribute("aria-pressed", String(active));
    });
    modeNote.textContent = mode === "timed"
      ? "10 questions tirées au sort, 10 minutes, correction complète à la fin. Exercice interne non officiel."
      : "Répondez à votre rythme et découvrez la correction après chaque réponse.";
    startButton.textContent = mode === "timed" ? "Démarrer l’examen blanc →" : "Commencer l’entraînement →";
  });
});

startButton.addEventListener("click", startSession);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (answered) return;
  const selected = form.querySelector('input[name="quiz-answer"]:checked');
  if (!selected) {
    form.reportValidity();
    return;
  }

  answered = true;
  const item = sessionQuestions[currentQuestion];
  const answer = Number(selected.value);
  selectedAnswers[currentQuestion] = answer;
  const isCorrect = answer === item.answer;
  if (isCorrect) score += 1;
  scoreLabel.textContent = mode === "practice" ? `Score : ${score}` : "Réponse enregistrée";

  if (mode === "practice") {
    optionsContainer.querySelectorAll("input").forEach((input) => {
      input.disabled = true;
      if (Number(input.value) === item.answer) input.closest(".quiz-option").classList.add("correct");
      else if (input.checked) input.closest(".quiz-option").classList.add("incorrect");
    });
    feedback.textContent = `${isCorrect ? "Bonne réponse." : "Pas tout à fait."} ${item.explanation}`;
    feedback.classList.toggle("is-correct", isCorrect);
    feedback.classList.toggle("is-incorrect", !isCorrect);
    feedback.hidden = false;
  }

  submitButton.hidden = true;
  nextButton.hidden = false;
  nextButton.textContent = currentQuestion === sessionQuestions.length - 1 ? "Voir le résultat" : "Question suivante →";
  updateProgress();
  nextButton.focus();
});

nextButton.addEventListener("click", () => {
  if (!answered) return;
  if (currentQuestion + 1 >= sessionQuestions.length) {
    finishSession();
    return;
  }
  currentQuestion += 1;
  renderQuestion();
  questionLabel.focus();
});

resetQuiz();
