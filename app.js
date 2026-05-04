document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const questionsContainer = document.getElementById('questions-container');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    const printBtn = document.getElementById('print-btn');
    
    const quizSection = document.getElementById('quiz-section');
    const resultSection = document.getElementById('result-section');
    const scoreText = document.getElementById('score-text');
    const reviewQuestionsContainer = document.getElementById('review-questions-container');
    const retryWrongBtn = document.getElementById('retry-wrong-btn');
    const restartBtn = document.getElementById('restart-btn');

    // State
    const itemsPerPage = 10;
    let currentPage = 1;
    let questions = window.questionsData || [];
    let totalPages = Math.ceil(questions.length / itemsPerPage);
    
    // Store user inputs to maintain state between pages
    // Format: { questionId: { blankIndex: value } }
    let userAnswers = {};
    let wrongQuestions = [];

    // Initialize
    init();

    function init() {
        totalPages = Math.ceil(questions.length / itemsPerPage);
        generateRandomBlanks();
        renderPage();
    }

    function generateRandomBlanks() {
        // Reset user answers
        userAnswers = {};
        
        questions = questions.map(q => {
            // Find all bracketed contents to count them
            const regexCount = /\[(.*?)\]/g;
            let matchCount = 0;
            while(regexCount.exec(q.text) !== null) {
                matchCount++;
            }

            // Decide how many blanks to create (e.g., 60% of total brackets, minimum 1)
            let numBlanks = Math.max(1, Math.floor(matchCount * 0.6));
            if (matchCount === 0) numBlanks = 0;

            // Randomly select indices to become blanks
            let allIndices = Array.from({length: matchCount}, (_, i) => i);
            allIndices.sort(() => 0.5 - Math.random());
            let selectedIndices = new Set(allIndices.slice(0, numBlanks));

            let processedText = q.text;
            let blanks = [];
            let currentBracketIndex = 0;
            let currentBlankIndex = 0;

            const regexReplace = /\[(.*?)\]/g;
            processedText = processedText.replace(regexReplace, (match, p1) => {
                if (selectedIndices.has(currentBracketIndex)) {
                    blanks.push(p1);
                    const inputHtml = `<input type="text" class="blank-input" 
                        data-qid="${q.id}" 
                        data-bindex="${currentBlankIndex}" 
                        data-answer="${p1}"
                        placeholder="빈칸 입력">`;
                    currentBlankIndex++;
                    currentBracketIndex++;
                    return `<span class="blank-wrapper">${inputHtml}</span>`;
                } else {
                    currentBracketIndex++;
                    // Render as bold text instead of a blank to show it's a key term
                    return `<strong class="highlight-text">${p1}</strong>`;
                }
            });

            return { ...q, processedText, blanks };
        });
    }

    function renderPage() {
        questionsContainer.innerHTML = '';
        
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, questions.length);
        const pageQuestions = questions.slice(startIndex, endIndex);

        pageQuestions.forEach(q => {
            const card = document.createElement('div');
            card.className = 'question-card';
            card.innerHTML = `
                <h3>${q.article}</h3>
                <div class="question-text">${q.processedText}</div>
            `;
            questionsContainer.appendChild(card);
        });

        // Restore user answers if any
        restoreInputs(questionsContainer);

        // Add event listeners to new inputs to save state
        const inputs = questionsContainer.querySelectorAll('.blank-input');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const qid = e.target.getAttribute('data-qid');
                const bindex = e.target.getAttribute('data-bindex');
                
                if (!userAnswers[qid]) userAnswers[qid] = {};
                userAnswers[qid][bindex] = e.target.value.trim();
                
                // Remove visual feedback if user modifies input after grading
                e.target.classList.remove('correct', 'incorrect');
            });
        });

        updatePagination();
    }

    function restoreInputs(container) {
        const inputs = container.querySelectorAll('.blank-input');
        inputs.forEach(input => {
            const qid = input.getAttribute('data-qid');
            const bindex = input.getAttribute('data-bindex');
            if (userAnswers[qid] && userAnswers[qid][bindex] !== undefined) {
                input.value = userAnswers[qid][bindex];
            }
        });
    }

    function updatePagination() {
        if (currentPage === 1) {
            prevBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'inline-block';
        }

        if (currentPage === totalPages) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-block';
        } else {
            nextBtn.style.display = 'inline-block';
            submitBtn.style.display = 'none';
        }
    }

    // Navigation Events
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage();
            window.scrollTo(0, 0);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderPage();
            window.scrollTo(0, 0);
        }
    });

    // Grade and Show Results
    submitBtn.addEventListener('click', () => {
        gradeQuiz();
    });

    function gradeQuiz() {
        let correctCount = 0;
        wrongQuestions = [];

        // Save current page inputs before grading
        const currentInputs = questionsContainer.querySelectorAll('.blank-input');
        currentInputs.forEach(input => {
            const qid = input.getAttribute('data-qid');
            const bindex = input.getAttribute('data-bindex');
            if (!userAnswers[qid]) userAnswers[qid] = {};
            userAnswers[qid][bindex] = input.value.trim();
        });

        questions.forEach(q => {
            let isQuestionCorrect = true;
            
            for (let i = 0; i < q.blanks.length; i++) {
                const userAnswer = userAnswers[q.id] ? userAnswers[q.id][i] : "";
                if (userAnswer !== q.blanks[i]) {
                    isQuestionCorrect = false;
                    break;
                }
            }

            if (isQuestionCorrect) {
                correctCount++;
            } else {
                wrongQuestions.push(q);
            }
        });

        showResults(correctCount);
    }

    function showResults(correctCount) {
        quizSection.style.display = 'none';
        resultSection.style.display = 'block';
        window.scrollTo(0, 0);

        scoreText.innerText = `총 ${questions.length}조문 중 ${correctCount}조문 정답!`;

        renderReviewQuestions();
    }

    function renderReviewQuestions() {
        reviewQuestionsContainer.innerHTML = '';
        
        if (wrongQuestions.length === 0) {
            reviewQuestionsContainer.innerHTML = '<p style="text-align:center; color: var(--success-color); font-weight: bold; padding: 20px;">모든 문제를 맞히셨습니다! 축하합니다.</p>';
            retryWrongBtn.style.display = 'none';
            return;
        }

        retryWrongBtn.style.display = 'inline-block';

        wrongQuestions.forEach(q => {
            const card = document.createElement('div');
            card.className = 'question-card';
            
            // For review mode, we need unique IDs so it doesn't clash with main logic if needed
            // But we can reuse processedText.
            card.innerHTML = `
                <h3>${q.article}</h3>
                <div class="question-text review-text">${q.processedText}</div>
            `;
            reviewQuestionsContainer.appendChild(card);
        });

        // Pre-fill user's previous wrong answers so they know what they wrote,
        // or just let them try again. Let's let them see what they wrote and correct it.
        const inputs = reviewQuestionsContainer.querySelectorAll('.blank-input');
        inputs.forEach(input => {
            const qid = input.getAttribute('data-qid');
            const bindex = input.getAttribute('data-bindex');
            const answer = input.getAttribute('data-answer');
            
            const prevAnswer = userAnswers[qid] ? userAnswers[qid][bindex] : "";
            input.value = prevAnswer;

            // Mark correct/incorrect visually
            if (prevAnswer === answer) {
                input.classList.add('correct');
            } else {
                input.classList.add('incorrect');
            }

            // Remove class when user types again
            input.addEventListener('input', (e) => {
                e.target.classList.remove('correct', 'incorrect');
            });
        });
    }

    retryWrongBtn.addEventListener('click', () => {
        const inputs = reviewQuestionsContainer.querySelectorAll('.blank-input');
        let allReviewCorrect = true;

        inputs.forEach(input => {
            const qid = input.getAttribute('data-qid');
            const bindex = input.getAttribute('data-bindex');
            const answer = input.getAttribute('data-answer');
            const currentVal = input.value.trim();
            
            // Update user answers state
            if (!userAnswers[qid]) userAnswers[qid] = {};
            userAnswers[qid][bindex] = currentVal;

            if (currentVal === answer) {
                input.classList.remove('incorrect');
                input.classList.add('correct');
                
                // Hide hint if exists
                const nextSibling = input.nextElementSibling;
                if (nextSibling && nextSibling.classList.contains('correct-answer-hint')) {
                    nextSibling.remove();
                }
            } else {
                input.classList.remove('correct');
                input.classList.add('incorrect');
                allReviewCorrect = false;
                
                // Optionally show correct answer if they get it wrong again? 
                // The prompt says "직접 적으며 정답 확인도 가능해".
                // Let's not reveal the answer directly, but provide visual red feedback.
            }
        });

        if (allReviewCorrect) {
            alert("오답노트의 모든 문제를 맞히셨습니다!");
        } else {
            alert("아직 틀린 빈칸이 있습니다. 빨간색으로 표시된 부분을 다시 확인해주세요.");
        }
    });

    restartBtn.addEventListener('click', () => {
        // Reset state
        currentPage = 1;
        wrongQuestions = [];
        
        // Regenerate random blanks for the new session
        generateRandomBlanks();
        
        quizSection.style.display = 'block';
        resultSection.style.display = 'none';
        
        renderPage();
        window.scrollTo(0, 0);
    });

    // Print functionality
    printBtn.addEventListener('click', () => {
        // If in quiz mode, we temporarily render ALL questions to allow printing everything
        if (quizSection.style.display !== 'none') {
            const originalHTML = questionsContainer.innerHTML;
            
            // Render all
            questionsContainer.innerHTML = '';
            questions.forEach(q => {
                const card = document.createElement('div');
                card.className = 'question-card';
                card.innerHTML = `
                    <h3>${q.article}</h3>
                    <div class="question-text">${q.processedText}</div>
                `;
                questionsContainer.appendChild(card);
            });
            
            // Restore inputs across all
            restoreInputs(questionsContainer);
            
            window.print();
            
            // Restore pagination view
            renderPage();
        } else {
            window.print();
        }
    });
});
