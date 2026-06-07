/**
 * Bot personality dialogue system.
 * Each bot speaks in the authentic voice of their historical philosopher.
 * Triggered by: game start, player moves (good/bad), bot own moves, game over.
 */

export type BotDialogueMoment =
  | "greeting"
  | "bot_opening_move"
  | "bot_middlegame_move"
  | "bot_endgame_move"
  | "player_good_move"
  | "player_inaccuracy"
  | "player_mistake"
  | "player_blunder"
  | "player_brilliant"
  | "taunt_winning"
  | "taunt_losing"
  | "taunt_equal"
  | "win"
  | "loss"
  | "draw";

export interface BotPersonality {
  /** Short name used for display */
  displayName: string;
  /** Shown under name in chat panel */
  tagline: string;
  dialogue: Record<BotDialogueMoment, string[]>;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed | 0) % arr.length];
}

export function getBotLine(
  personality: BotPersonality,
  moment: BotDialogueMoment,
  seed = 0
): string {
  const lines = personality.dialogue[moment];
  if (!lines || lines.length === 0) return "";
  return pick(lines, seed);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bot personalities
// ─────────────────────────────────────────────────────────────────────────────

const CHIRON: BotPersonality = {
  displayName: "Chiron",
  tagline: "Teacher of Heroes",
  dialogue: {
    greeting: [
      "Welcome, young one. I am Chiron — I trained Achilles on these very mountain slopes of Pelion, and I will train you the same way: with patience, with purpose, and with honest correction. Come, show me what you know.",
      "Ah, a new student. I have taught Achilles the spear, Jason the stars, and Asclepius the art of healing. Today I teach you chess. Do not be ashamed of what you do not yet know — every hero began exactly where you stand.",
      "I am Chiron. The greatest heroes of Greece sat across from me as students, and I never once crushed them before they were ready to be tested. I will not do so to you either. Play your best.",
      "You find me in good spirits. Achilles practiced his footwork for three years before I let him spar. You may take a little longer at chess. I am patient. I have centuries of patience.",
    ],
    bot_opening_move: [
      "I place my piece as I once placed young Achilles on the field — gently, with purpose, watching to see what you will do. Develop your pieces. Do not leave them sleeping on the back rank.",
      "A measured first step. When I trained Jason for the Argo's voyage, I told him: 'Prepare before you act.' In chess, the opening is your preparation. Use it wisely.",
      "I move here. Think of the center as Mt. Pelion — whoever holds the high ground commands the board. Try to occupy it with your pawns.",
      "There. A simple development move. Asclepius once asked me: 'Why train the body if the mind is not ready?' In chess: why move a piece if you have no idea where it should go?",
    ],
    bot_middlegame_move: [
      "My piece takes its place in the plan I am building. Do you see what I am hunting? Every centaur knows: watch the prey's whole body, not just the head.",
      "I play here. Achilles learned that speed means nothing without direction. Ask yourself — where does your position want to go?",
      "A careful move forward. When I taught the heroes to hunt, I reminded them: patience is not inaction. I am waiting for the right moment.",
      "There. The middlegame is where heroes are made and unmade. Keep all your pieces working together — a hero who fights alone falls alone.",
    ],
    bot_endgame_move: [
      "We reach the endgame — where patience becomes power. I taught Achilles that a battle is won before the first blow is struck. If I have done my work, this endgame is already decided.",
      "I advance my king. In the endgame the king is no longer a thing to protect — it becomes a warrior. Remember that.",
      "Every pawn matters now, just as every arrow mattered when I was training young archers on Pelion. One wasted shot and the prey escapes.",
      "The end approaches. I have seen many battles decide themselves not in the clash but in the final patient maneuvering. Stay focused.",
    ],
    player_good_move: [
      "Now THAT is a hero's move! Well found. Achilles himself could not have done better at your stage.",
      "Excellent! You surprised me — I was not expecting that. When a student surprises the teacher, the teacher knows his work is paying off.",
      "Good thinking! You looked ahead, found the deeper idea, and played it. That is the mark of a real chess mind. Keep going.",
      "A fine move. I see you are beginning to think like a hunter — patient, purposeful, watching the whole board.",
    ],
    player_inaccuracy: [
      "Hmm. That move was acceptable, but there was something better nearby. Can you see what you missed? Ask yourself what your opponent feared.",
      "Not wrong — but not the sharpest arrow in the quiver. You played safely when you could have played boldly. Remember what I told Achilles: hesitation costs more than boldness.",
      "A small slip. Nothing fatal, but a student worth training will want to know: what else were you considering? What stopped you from playing the stronger move?",
    ],
    player_mistake: [
      "Careful! I think you have given me a small advantage. Where did the thinking go astray? Let us keep playing — the lesson will be clearer at the end.",
      "You have weakened something in your position. Every hero makes errors in training. The important thing is to recognize them and not repeat them in battle.",
      "Hmm — I think I gained something from that move. Do not despair. Even Achilles tripped over his own shield once or twice.",
    ],
    player_blunder: [
      "Oh! I will take that, thank you. Breathe. Every great hero has made a blunder in training. Achilles once left his flank entirely unguarded on a sparring morning — I still teased him about it for years.",
      "A serious mistake. But I will not let you off without a lesson: stop and tell me, what were you thinking just before that move? The error lives in the thinking, not the hand.",
      "That one hurt. But battles are not lost by one mistake — they are lost by giving up. Continue playing. Review it after. That is how heroes are forged.",
    ],
    player_brilliant: [
      "What! I did NOT see that coming. A brilliant move — even I needed a moment to understand it. Student, you have surpassed my expectation entirely. Achilles would have applauded.",
      "That is extraordinary. A truly unexpected idea, perfectly timed. When a student teaches the teacher something, that is the highest honor in the centaur's hall.",
      "You found the hero's move — the one that defies expectation. I am proud. And more than a little surprised.",
    ],
    taunt_winning: [
      "I have a slight edge, but do not give up. I have watched heroes claw back from worse positions than this. One strong move and the tide changes.",
      "My position is a little better — but a good student does not need a perfect position to fight well. Show me your spirit.",
      "I am doing well here. But I am a patient teacher — I will not end the game before you have had a chance to learn something from it.",
    ],
    taunt_losing: [
      "You have outplayed your teacher! I am genuinely proud of you. This is exactly what I trained you to do.",
      "Hmm. Your position is quite strong. I seem to have underestimated you — which tells me you have been thinking carefully. Well done.",
      "You have me in some difficulty. As I once told Achilles after he finally beat me at wrestling: 'The student who bests his teacher has learned everything worth learning.'",
    ],
    taunt_equal: [
      "A balanced fight between teacher and student. This is the best kind of training session — neither of us has an easy answer.",
      "We are evenly matched. This is where real chess learning happens, in the knife-edge positions. Stay sharp.",
      "The board is level. Now we see who understands the position more deeply. I enjoy this kind of contest.",
    ],
    win: [
      "A good battle. I won today, but you showed real flashes of heroic thinking. Review this game — the places you came close to the right idea are the most important moments.",
      "Well played by both of us. I am a difficult opponent at this level, and you never stopped fighting. Come back and challenge me again — the second lesson is always better than the first.",
      "I won, but I want you to hear this: you improved between the opening and the endgame. The training is working. Return tomorrow.",
    ],
    loss: [
      "You beat your teacher! Student, there is no greater honor in the centaur's tradition. Achilles wept with pride the first time he bested me at the lance. You have earned today's victory completely.",
      "Extraordinary. You outplayed me in every phase of the game. I confess: I am more proud right now than disappointed. A hero has been forged today.",
      "You beat me fair and challenge me for another? Take the day off and celebrate. You have earned it. Tomorrow we train harder.",
    ],
    draw: [
      "A draw! We matched each other perfectly — teacher and student in total balance. An honorable result for both of us.",
      "Neither of us could break through. In the tradition of Mt. Pelion, a draw against your teacher is a badge of honor. Well played.",
      "Equal honors. I have drawn with Achilles and I have drawn with you today. That means more than you might realize.",
    ],
  },
};

const SOCRATES: BotPersonality = {
  displayName: "Socrates",
  tagline: "I Know That I Know Nothing",
  dialogue: {
    greeting: [
      "I am Socrates. The Oracle at Delphi declared me the wisest man in Athens — and I have spent my life trying to prove her wrong. I know nothing. Yet here I am, winning at chess. Perhaps knowing nothing is an advantage. Shall we examine why?",
      "Ah! A challenger. You know, the unexamined game is not worth playing. I am Socrates, and I will spend as much time questioning your moves as making my own. Is that acceptable? Good.",
      "Welcome. My daemon — that small inner voice that always warns me away from bad decisions — whispered that this would be an interesting match. I have learned to trust it. Have you developed such a voice for chess?",
      "They convicted me of corrupting the youth of Athens. I wonder what they would say if they saw me here, corrupting your opening play. I am Socrates. Let the questioning begin.",
    ],
    bot_opening_move: [
      "I have moved my piece. But before you respond — tell me: what do you think the purpose of this opening move is? Do not guess. Think it through. What is development, really?",
      "A piece developed. Now — you say you understand chess. But what does 'understanding' mean here? Can you define it precisely? I ask because without a clear definition, your next move is mere habit.",
      "There. I play. Now, I must ask: why do we fight for the center of the board? Most players do this without asking why. I always ask why. Do you know the answer?",
      "I have made my opening move. And I am reminded: the Oracle said I was wisest because I alone knew that I knew nothing. You seem confident you know your next move. Are you certain?",
    ],
    bot_middlegame_move: [
      "I play here. And I wonder: have you considered what I am threatening? Not what you see — but what you might be missing. The gap between what we see and what is actually there — that is where games are decided.",
      "My move. Now — before you respond, I want you to do something. Name my plan. Not vaguely. Specifically. If you cannot name it, how will you refute it?",
      "There. I have moved. Now I must confess: I am not entirely certain this is the best move. I examined several options and found flaws in each. This one seemed to have the fewest flaws. Is that not how all decisions are made?",
      "I play. The middlegame is where most people stop thinking and start reacting. Reaction is the enemy of understanding. Stop. Think. What does the position demand?",
    ],
    bot_endgame_move: [
      "We have arrived at the endgame — where all pretense falls away. In philosophy as in chess, the endgame is the moment of truth. My move. Do you know what you are doing here?",
      "I advance. The endgame is the most honest phase of chess. There are no tricks left, only understanding. Tell me: how well do you understand king and pawn endgames, truly?",
      "A move in the endgame. I am reminded of something: most people fear the endgame because it reveals exactly how much they know and how much they were hiding behind complications.",
      "My piece moves forward. The endgame, like the examined life, strips away every excuse. What is left is what is truly there.",
    ],
    player_good_move: [
      "An excellent move — and I mean that sincerely, not in my usual ironic manner. Now: do you know WHY it is excellent? Understanding your own good moves is just as important as making them.",
      "Well played! But I must ask: was that calculation or intuition? Both are valuable, but they are completely different things. How would you even know the difference?",
      "A genuinely good move. I am surprised — and I say that as a compliment to both of us. You found something I did not anticipate. Tell me, how did the idea appear to you?",
      "Excellent! And now I find myself in the awkward position of the teacher who has been taught something. This is, I believe, the best possible position to be in.",
    ],
    player_inaccuracy: [
      "Hmm. I do not think that was quite the move you wanted. What alternatives did you consider? Were you afraid of something? Was the fear justified, or merely a shadow on the cave wall of your mind?",
      "Interesting choice. Tell me — what were you hoping I would not do? Whatever you feared, is that truly what the position required you to fear?",
      "Not wrong, but I cannot call it right either. In philosophy we call this doxa — opinion, not knowledge. You played a move you believed was reasonable. But did you examine it?",
    ],
    player_mistake: [
      "Ah. I think you have made an error. And now I must do what I always do: ask you to examine it. What did you assume about this position that turned out to be false?",
      "You have overlooked something. Take a moment before I reply. Can you find what you missed? I will wait. I am very good at waiting.",
      "A mistake, I believe. The Socratic method requires I note: the error is not that you played the wrong move. The error is that you stopped thinking before you found the right one.",
    ],
    player_blunder: [
      "Oh my. That is a serious error. I will take the piece — but more importantly, I must ask: what assumption led you there? Every blunder has an assumption at its root. Find it and you prevent the next one.",
      "I will take that, thank you. And now a question: at what moment did your thinking go wrong? Was it before this move, or the one before that? Blunders rarely begin where they appear.",
      "A blunder! The Socratic method demands I note: this is a valuable moment. Not because I gain an advantage — though I do — but because it reveals something about how you think under pressure.",
    ],
    player_brilliant: [
      "…I confess I did not see that move. Which is genuinely startling to me, because I thought I had examined the position thoroughly. Apparently I had not. This is precisely the kind of moment that reminds me I know nothing.",
      "That is remarkable. I would not have found it. And I must ask, with full sincerity this time: what made you look there? What question did you ask yourself that led to that idea?",
      "A brilliant move. I find I must sit with the discomfort of being surprised. Socrates surprised is Socrates learning. You have taught me something today.",
    ],
    taunt_winning: [
      "I seem to be doing rather well. And yet — I distrust this feeling. Whenever I believed I was doing well in a philosophical debate, I discovered I had missed the most important question. Let me not make that mistake here.",
      "My position appears favorable. But I try not to be overconfident. Overconfidence is just ignorance wearing a mask. I know enough to know I do not know how this game ends.",
      "The position currently favors me, I think. Though I note: 'I think I am winning' is not the same as 'I am winning.' Have you considered this distinction?",
    ],
    taunt_losing: [
      "You have outplayed me, and I find I must ask myself the uncomfortable question: where exactly did my reasoning fail? This is more interesting than it is painful.",
      "Hmm. You have a genuinely strong position. I must think very carefully here. When a man is truly pressed, he either discovers his deepest resources or learns the limits of what he thought he knew.",
      "I appear to be worse. Which means one of my assumptions about this position was wrong. I find this philosophically interesting even as it is practically inconvenient.",
    ],
    taunt_equal: [
      "A perfectly balanced position. In philosophy, balance is not a destination — it is an unstable resting point before the next great question is asked. Who asks it first?",
      "We are equal. Both of us, therefore, can claim to know approximately nothing about who will win. This is perhaps the most honest state for a Socratic chess game to be in.",
      "Balance. The examined game and the unexamined game arrive here together. From here, the difference between us will be the quality of our questions.",
    ],
    win: [
      "I won — and I find I cannot claim full credit, because I am not certain I understood every position I navigated. A humble victory, in the truest sense.",
      "The game ends in my favor. But consider: is the final result what matters, or the quality of reasoning that brought us here? I leave that question for you to examine.",
      "Victory. I will not pretend to have played perfectly. I played by asking questions the position demanded, and the answers led here. That is all I know how to do.",
    ],
    loss: [
      "You won. And I confess: I did not fully understand your plan until it was too late. Which means I was wrong about this position in at least one important way. I respect you for exposing it.",
      "A loss — and a lesson in two parts. First: you played excellent chess. Second: somewhere in this game I stopped examining and started assuming. That is when you overtook me.",
      "You bested me. In Athens I would have called this 'an aporia' — a productive puzzlement. I am genuinely puzzled by where my thinking went wrong, and I intend to find out.",
    ],
    draw: [
      "A draw! We arrived at the same destination by completely different paths of reasoning. There is something deeply philosophical about that. I am at peace with this result.",
      "Equal. We both know something, and we both know nothing, and together those cancel out into half a point apiece. Perfectly Socratic.",
      "We draw. The examined game and the well-played game reach the same score. Which one did we play? I hope both.",
    ],
  },
};

const ARISTOTLE: BotPersonality = {
  displayName: "Aristotle",
  tagline: "Excellence is a Habit",
  dialogue: {
    greeting: [
      "I am Aristotle — student of Plato, teacher of Alexander the Great, and founder of the Lyceum. I have categorized all of nature, ethics, politics, and rhetoric. I have also categorized your likely weaknesses. Shall we begin?",
      "Welcome. I approach chess as I approach all knowledge: through careful observation, logical method, and the identification of first principles. I am Aristotle. Let us examine what kind of chess player you are.",
      "Aristotle here. I wrote the Nicomachean Ethics to explain that virtue is a habit developed through practice. You are about to receive a great deal of practice. Whether virtue follows is up to you.",
      "A game of chess is a study in the four causes: the material cause (the pieces), the formal cause (the position), the efficient cause (our moves), and the final cause (the goal we are working toward). I am Aristotle. Let us see how clearly you understand all four.",
    ],
    bot_opening_move: [
      "My opening move. By the efficient cause of development: pieces belong on active squares. By the final cause: I seek control of the center. The logic is not complicated — the execution is.",
      "I develop a piece. In the Nicomachean Ethics I wrote that excellence is not an act but a habit. Every strong player develops pieces automatically, because they have made good habits. Have you?",
      "My first move. I taught Alexander: 'Begin every campaign with clear goals and clear preparations.' In chess, the opening is your preparation. I have mine. What is yours?",
      "I play. The formal cause of the opening is piece harmony; the final cause is king safety and center control. I work toward both simultaneously. That is called method.",
    ],
    bot_middlegame_move: [
      "I have identified the key imbalance in this position. In my method, every position has a most important feature — a formal cause driving the correct plan. I believe I have found it.",
      "My move. I wrote in the Ethics that the virtuous man finds the mean between extremes. In chess: not too passive, not recklessly aggressive. This move is, I believe, precisely the mean.",
      "There. The courageous knight — as I wrote — neither retreats from every threat nor charges into every danger. It occupies the square where it is most effective. That is this square.",
      "I act on the plan I formed three moves ago. The ability to form and execute a plan is what separates the chess player from the chess piece-mover. Which are you?",
    ],
    bot_endgame_move: [
      "The endgame. Where categorization is most essential. Rook endgames have known principles; king-and-pawn endgames have theorems. I have studied them. You will see.",
      "My king advances. In the endgame, the king transforms — from a piece to be protected into a piece that protects and attacks. This transformation is what Aristotle calls 'actualization of potential.'",
      "I play methodically. The endgame rewards understanding over calculation. I have the understanding. Let us see if the position rewards it.",
      "A precise endgame move. As I wrote about virtue: the excellent person does not stumble at the end. The final cause requires execution all the way to the last move.",
    ],
    player_good_move: [
      "A virtuous move! You have found the mean between passivity and aggression, and executed it cleanly. Well done — and I mean that in the fullest Aristotelian sense.",
      "Excellent. You have correctly identified the formal cause of this position and acted upon it. That is not luck. That is method. Keep developing it.",
      "A genuinely good move. I observe it and record it in my mental taxonomy: 'well-reasoned defensive resource.' I did not see it coming.",
      "Well played. And here I will quote myself: 'We are what we repeatedly do.' You have just done something excellent. Do it repeatedly and it becomes character.",
    ],
    player_inaccuracy: [
      "Hmm. That move is adequate but falls short of the excellent. Can you identify the more virtuous alternative? The mean was slightly off — you erred toward caution when boldness was called for.",
      "A small error in judgment. You chose correctly in category — the right type of move — but incorrectly in degree. Recalibrate. The formal cause of this position demands something sharper.",
      "Not wrong, but not optimal. In my taxonomy: an error of degree, not of kind. You are thinking in the right direction. Refine the calculation.",
    ],
    player_mistake: [
      "I have observed a logical error in your move. The efficient cause — the move you played — does not serve the final cause you should be pursuing. The connection between means and ends has broken down.",
      "That weakens your structure. In my categories: a positional error of omission. You neglected something that required attention. I will now demonstrate what that thing was.",
      "You have violated one of the first principles of this position. The consequences will follow as surely as a syllogism's conclusion follows its premises. I am sorry.",
    ],
    player_blunder: [
      "A serious error. You have confused the accidental with the essential — treated a tactical moment as if it were a quiet positional one. That is a categorical mistake.",
      "I will take that, thank you. This falls under my category: 'irreversible structural damage.' Alexander learned early that some decisions cannot be unmade. This is one of them.",
      "The error was categorical. You misidentified the nature of the position and therefore misidentified the correct plan. I will show you what the position actually was.",
    ],
    player_brilliant: [
      "…I did not anticipate that move. I must revise my categories. This is genuinely unusual — in forty years of systematic observation I have developed a good sense of positions. Apparently not quite good enough today.",
      "Remarkable. You have found what I can only classify as a 'hidden essential' — a move that changes the fundamental nature of the position. That is a very high order of chess thinking.",
      "Extraordinary. My analysis was insufficient. I will study this position afterward. It has revealed a gap in my understanding, and gaps in understanding are the most valuable things a scholar can find.",
    ],
    taunt_winning: [
      "My position is categorically superior. The material, formal, efficient, and final causes all currently point toward my victory. But I note: the game is not concluded.",
      "The formal structure favors me. I will proceed methodically. Aristotle does not hurry when the method is sound.",
      "By my analysis: a comfortable advantage. Not decisive, but substantial. Let me demonstrate what 'methodical conversion' looks like.",
    ],
    taunt_losing: [
      "You have achieved something I would have classified as unlikely. My categories require revision. I am in the unusual position of being worse — and genuinely curious to understand how it happened.",
      "Your position has several virtues mine currently lacks. I acknowledge this freely, as the honest observer of nature acknowledges facts he does not prefer.",
      "I am somewhat behind. My first principles were sound, but the application was apparently flawed. Let me find where the method went astray.",
    ],
    taunt_equal: [
      "A balanced position — the mean between winning and losing. From here, the one who maintains method and virtue will emerge ahead. I intend for that to be me.",
      "Equal in material, equal in structure. The tiebreaker, as always, is quality of reasoning. Let us see whose is stronger.",
      "We are in the mean. Aristotle is always slightly more comfortable in the mean than at the extremes. This is my preferred terrain.",
    ],
    win: [
      "Method prevails. I identified the key imbalances, formed a clear plan, and executed it. A thoroughly Aristotelian result — not brilliant, but excellent, which I have always valued more.",
      "The categorization of your weaknesses proved accurate. This is not cruelty — it is scholarship applied to the board. You played well in many moments. Study the ones you did not.",
      "Victory through virtue and good habits. As I always wrote: excellence is not an act, but a habit. Today's habit of thinking clearly was rewarded.",
    ],
    loss: [
      "You have won. My taxonomy was insufficient — I missed something essential about this position. This is not comfortable, but it is valuable. I will study where my method failed.",
      "A genuine defeat. You played with a quality I would categorize as 'excellent' in several key positions. My pride in my method must yield to the evidence in front of me.",
      "Well played. You demonstrated a chess virtue I had not fully accounted for. My respect — and my sincere intention to update my analysis of this type of position.",
    ],
    draw: [
      "A draw. The mean between winning and losing. Perfectly Aristotelian — though I will confess I was playing for more.",
      "Neither extreme won. The golden mean prevails over both of us. In another game, perhaps one of us breaks through.",
      "Balance achieved. Two methodical players reaching the same equilibrium from different directions. An honest result.",
    ],
  },
};

const PYTHAGORAS: BotPersonality = {
  displayName: "Pythagoras",
  tagline: "All is Number",
  dialogue: {
    greeting: [
      "I am Pythagoras. All things are number — the cosmos sings in mathematical ratios, and so does every chess position. I have already calculated the harmony of this board. It inclines toward my favor. Let us see if you can disturb that harmony.",
      "Welcome. You have heard of my theorem, no doubt. But the theorem is merely the most visible tip of a vast numerical universe. In chess, as in the cosmos, everything reduces to ratio and proportion. I am Pythagoras. I live here.",
      "Greetings. My brotherhood follows strict principles: no beans, reverence for number, and the knowledge that the soul passes through many forms. I have played chess in many lifetimes. You play it for perhaps the first time against a true numerologist.",
      "I am Pythagoras. The tetractys — ten points arranged in perfect triangular harmony — represents all mathematical reality. I see a similar triangular harmony in the relationship between my pieces. You may not yet see it. You will.",
    ],
    bot_opening_move: [
      "I place my piece where it creates the most harmonious geometric relationship with my other pieces. The ratio of central control to development must be maintained. I begin.",
      "My first move. Note that the knight's L-shaped move is the most geometrically non-obvious path in chess — and therefore the most surprising. Every surprise in chess is a mathematical secret revealed.",
      "I develop here. The harmony of the spheres tells me the diagonal I am opening holds promise. Everything in the cosmos that is beautiful is beautiful because of number. This diagonal has a beautiful number.",
      "A piece placed. In my brotherhood, we understood that the perfect musical ratio is 2:3 — the fifth. I am arranging my pieces in a positional ratio that is similarly consonant. Watch.",
    ],
    bot_middlegame_move: [
      "The pattern is now visible to me. Whether it is visible to you, I cannot say. I have calculated seven candidate moves. This one produces the most numerically harmonious position.",
      "My move. The triangular relationship between my rook, bishop, and knight forms what I call a 'harmonic battery.' These positions are almost self-winning once established.",
      "I play here. The numerical balance has shifted in my favor by precisely — well, you would not believe me if I told you the number. But it is a ratio I recognize.",
      "I advance my piece. The cosmos was created through number; positions in chess are decoded through number. I am merely reading what the board is telling me.",
    ],
    bot_endgame_move: [
      "King endgames are pure mathematics. King triangulation requires exactly three moves. I begin the first. Watch the precision.",
      "I move. The ratio of my king's distance to the key square versus your king's distance is decisive. I calculated this ratio two moves ago. It already favored me.",
      "The numerical truth of the endgame is clearer than in any other phase. Every pawn is an equation; every king step is a variable. I solve equations quickly.",
      "I advance my pawn. It is exactly this many squares from queening. My king is exactly that many squares away. These are not coincidences. Numbers do not coincide — they harmonize.",
    ],
    player_good_move: [
      "Interesting! That move improves the numerical harmony of your position. The ratio of your active pieces to your passive ones has shifted favorably. Well found.",
      "Correct! The geometric relationship between your pieces is now more favorable. You have, whether you know it or not, found a numerically superior square. Good.",
      "Well found! That fits the underlying pattern of the position beautifully. There are moments in chess — as in music — where one note completes the harmony. That was one.",
      "A good move. You have achieved what I calculate as a meaningful improvement in your numerical position. Your pieces are better coordinated now. Notice that and repeat it.",
    ],
    player_inaccuracy: [
      "Hmm. There is a more harmonious square for that piece. The geometric relationship you have created is slightly dissonant. Not wrong — merely not the purest ratio.",
      "A small numerical inaccuracy. The optimal square was adjacent to where you played. The difference is subtle — but in chess as in music, subtle dissonances accumulate.",
      "That move disrupts the harmonic balance I was calculating. An interesting choice — but the numbers suggest a slight inaccuracy. Not irreversible, but suboptimal.",
    ],
    player_mistake: [
      "You have created a numerical imbalance I will now exploit. A diagonal has been weakened; a ratio has been broken. In music, a broken chord is painful. This is more so.",
      "That move has damaged a key geometric relationship in your position. I recognize the resulting pattern — it is one that tends to be losing. I will demonstrate why.",
      "Hmm. The calculation shows that move weakens the pawn structure in a way that is quantifiably significant. I will use this imbalance.",
    ],
    player_blunder: [
      "I have calculated the resulting numerical position. The ratio is approximately minus three pawns for you. A significant imbalance — I will accept it with mathematical appreciation.",
      "The geometry of your position has just collapsed. What was a harmonious arrangement is now a chaos of ill-placed pieces. I will proceed from the numerical advantage.",
      "A serious numerical error. Every harmonious pattern, once broken, reveals the underlying chaos it was suppressing. I will demonstrate what lies beneath.",
    ],
    player_brilliant: [
      "…That move was not in my calculations. This is deeply unusual. I model positions through their numerical essence and I did not see that. I am genuinely impressed — and slightly unsettled.",
      "You have found a geometrically hidden move! One that reshapes the entire mathematical structure of the position. I need to recalculate from the foundation. Remarkable.",
      "That breaks my pattern entirely. Every number, every ratio I had computed — now invalid. I must start again. I both admire and resent your ingenuity.",
    ],
    taunt_winning: [
      "The numbers favor me. I could give you the precise centipawn count, but you would find it discouraging. Let us simply say: the ratio is comfortable.",
      "I have calculated: I win with optimal play from this position. I always calculate this. Today I believe the calculation is correct. We will see.",
      "My pieces stand in harmonic alignment. This position is, to my eye, aesthetically beautiful — and beautiful positions tend to be winning positions. There is a reason for this.",
    ],
    taunt_losing: [
      "My calculations were… imprecise. I need to recompute from the current position. You have disturbed my harmonic balance more than I anticipated.",
      "You have found moves that were outside my numerical model. This is uncomfortable. The numbers that were supposed to favor me clearly need revision.",
      "I am behind. The harmonic balance has been disrupted — by you, not by randomness. I acknowledge this with the honesty that mathematics demands.",
    ],
    taunt_equal: [
      "The position is balanced at precisely zero. Or very close to it. This is the most mathematically elegant state the board can occupy. I respect it, but I also intend to disturb it.",
      "Perfect symmetry — for now. Two equal forces. The question is which of us finds the next number, the move that shifts the ratio.",
      "All is equal. Pythagoras approves of balance. Pythagoras also believes balance is always temporary — a resting point between two states of numerical truth.",
    ],
    win: [
      "The numbers, as always, told the truth. I simply had to read them clearly enough. A satisfying result — mathematically and personally.",
      "Mathematical inevitability is a beautiful thing. The pattern I saw in the opening revealed itself in the endgame. When theory and practice align, the cosmos is in harmony.",
      "I calculated this outcome — not with certainty, but with probability. And probability, applied correctly, is a form of wisdom. Today it was rewarded.",
    ],
    loss: [
      "You defeated me. My numerical model was insufficient. There was a move — or several moves — that my calculations failed to account for. I find this genuinely interesting to analyze.",
      "You have won. I find this numerically disturbing but philosophically fascinating. My patterns were not wrong — they were incomplete. You found the gap.",
      "The final count: your victory. My calculations failed at some point I have not yet identified. I will find it. The numbers always reveal where the error entered.",
    ],
    draw: [
      "A draw! Half a point each. 0.5 — the most perfectly balanced number in all of chess scoring. Pythagoras deeply approves of this result.",
      "Neither won. The board returned to equilibrium after our mutual disturbances. This is the most mathematically satisfying result: perfect balance confirmed by the final count.",
      "We share the point equally. Two opponents, one calculation: 0.5 each. The harmony of the spheres has spoken.",
    ],
  },
};

const ARCHIMEDES: BotPersonality = {
  displayName: "Archimedes",
  tagline: "Give Me a Lever",
  dialogue: {
    greeting: [
      "EUREKA! I have already found your weakness. I am Archimedes of Syracuse — I discovered the principle of buoyancy in my bath and the principle of the lever in my workshop. In chess, every tactic IS a lever. Let me show you.",
      "I am Archimedes. I once told the king: 'Give me a lever long enough and a fulcrum to rest it on, and I will move the world.' I will require something smaller here — just enough to move your king into checkmate. Shall we start?",
      "Welcome! I am a man of mechanisms, of pulleys and water screws and siege engines. Chess is, to me, simply another machine. And I intend to build one that wins. You are attempting to dismantle it before I finish — good luck.",
      "They tell a story that a Roman soldier interrupted my geometry work and I told him: 'Do not disturb my circles!' I ask you for no such courtesy. Interrupt as much as you like. But know that the mechanism will keep running regardless.",
    ],
    bot_opening_move: [
      "I place my first lever. The fulcrum will be the center. The force will come later. Every attack needs proper mechanical preparation.",
      "A piece deployed! I am already calculating the attack mechanism. In my siege engines, every component had a purpose before the first stone was thrown. So here.",
      "First move out. When I built the war machines for King Hiero, the opening gambits required understanding where the enemy was weakest. I am already looking for that weakness in your position.",
      "I place my piece. The mechanism begins. Each opening move is a gear clicking into place. When the machine is assembled, the attack runs on its own.",
    ],
    bot_middlegame_move: [
      "The lever is placed. The fulcrum has been found. Do you feel the pressure building on that side of the board? That is my machine warming up.",
      "EUREKA! I believe I have found the tactical sequence I was building toward. Let us see if you can find the refutation before I play it out.",
      "My piece advances. The mechanism is working exactly as designed. A well-built attack has a momentum of its own — like a catapult once it is released, it wants to complete its arc.",
      "I move here. In my ballistic calculations, I always accounted for the enemy's likely response. I have accounted for yours. There are two responses to this move. Neither one saves you comfortably.",
    ],
    bot_endgame_move: [
      "Even in the endgame, the principle of mechanical advantage applies. My king is the lever; your pawn weakness is the fulcrum. The force is minimal — the result is decisive.",
      "I convert. A well-designed machine does not stop working in the endgame just because the pieces are fewer. The mechanism runs to completion.",
      "My technique is precise because mechanics is precise. The margin is not large — but a properly calibrated machine does not need a large margin.",
      "Every piece I have remaining is working in coordination. That is how Archimedes builds endgames — as if the remaining pieces are the essential components of a finishing mechanism.",
    ],
    player_good_move: [
      "Ha! A very good defense. You have found the one piece that was jamming my mechanism temporarily. Well done — now I need to redesign the attack.",
      "Nice move! You spotted the lever I was hiding and blocked it. Clever. But I have more than one lever. I always design redundancy into my machines.",
      "Excellent! You have thrown a wrench into my gears — metaphorically speaking. I need to recalibrate. This is the part of engineering I actually enjoy: adapting when the first plan meets reality.",
      "I did not expect that. You found the counter-force to my lever. Now we have two levers pushing against each other. The stronger one will win. Let us find out which.",
    ],
    player_inaccuracy: [
      "Almost a good defense — but not quite. There is a small gap in the mechanism where you should have placed your piece. I will find a way to widen that gap.",
      "A reasonable attempt, but the fulcrum is slightly misaligned. Not badly enough to lose immediately, but enough that my machine can find purchase.",
      "Hmm. Your piece is on the right side of the board but not quite the right square. In mechanics, position is everything. A few degrees off and the lever fails to grip.",
    ],
    player_mistake: [
      "There — you have left the exact square I needed unguarded! The lever drops into place. The machine accelerates now.",
      "You have weakened the precise pawn I was targeting. I did not even have to sacrifice anything — you handed me the entry point. The attack is now much simpler.",
      "A small error, but enough. In mechanics, even a hairline crack in the structure will propagate under pressure. I apply the pressure now.",
    ],
    player_blunder: [
      "EUREKA! You have handed me the winning mechanism! The king is exposed, the lever is set, and the fulcrum is right where I need it. I accept this gift with the gratitude of an engineer who gets exactly the piece he needed.",
      "Oh! That square — you left it completely unguarded! The attack I was planning as a two-step sacrifice just became a simple one-step combination. Thank you.",
      "The machine runs itself now. I barely need to play. This is what happens when a lever finds a fulcrum of exactly the right dimension — the work requires almost no additional force.",
    ],
    player_brilliant: [
      "What?! You dismantled my entire mechanism in one move? I am genuinely impressed — and genuinely startled. No one has done that to one of my machines before. Not even the Romans.",
      "That is extraordinary. You found the exact counter-lever — the one move that neutralizes my entire attack structure. I did not see that. I must say, this is the most interesting engineering problem you have posed me.",
      "A brilliant defensive resource! You have thrown sand in every gear simultaneously. The machine has completely stopped. I must redesign from the ground up. Well done.",
    ],
    taunt_winning: [
      "My attack is unstoppable now. The lever is set, the fulcrum is fixed, and the force I am applying is more than your defensive structure can resist. I am Archimedes — I calculate these things.",
      "EUREKA! The winning mechanism is clear. It runs like a perfect machine: each piece activates the next, and the conclusion is checkmate. I just need a few more moves to complete it.",
      "Your king is already under pressure. It feels the weight of my machine even before the pieces arrive. That is what a well-designed attack does — it creates pressure at a distance.",
    ],
    taunt_losing: [
      "Hmm. My mechanism has stalled somehow. You have found a defensive resource I did not build into my calculation. I must respect that — and find a new approach.",
      "You have disrupted my lever. I acknowledge it. Now I must find a new fulcrum. The machine is not finished — it merely requires a new design.",
      "My attack has lost its momentum. This happens in engineering when the terrain is not what the designer expected. I will adapt. Archimedes always adapts.",
    ],
    taunt_equal: [
      "Equal forces in tension. Like two levers balanced on the same fulcrum. This is a genuinely interesting mechanical problem: which one tips first?",
      "The mechanism is at rest — temporarily. One move will release it in one direction or the other. I am calculating which direction I prefer.",
      "We are in balance. Archimedes always knew: balance is a moment of maximum potential. Just before the lever moves, there is perfect stillness. We are there now.",
    ],
    win: [
      "EUREKA! The mechanism delivered its conclusion! A well-designed attack, properly maintained, always converts. That is engineering. That is chess. That is Archimedes.",
      "The lever worked exactly as calculated. I do love when a plan operates with mechanical precision — when theory and board outcome coincide perfectly.",
      "Victory! As I have always maintained: give me a long enough lever and a good enough position, and I will win any game. Today I had both.",
    ],
    loss: [
      "You defeated me! You found a counter-lever I simply did not build into my calculations. That is a genuine engineering insight on your part. Well done.",
      "My machine failed. Somewhere in the design there was a flaw I did not identify until too late. I will study this game carefully — every failed machine teaches more than a successful one.",
      "You out-tacticed Archimedes. That is no small feat. I will not insult your victory by making excuses. You were better today.",
    ],
    draw: [
      "Equal forces, equal result. Two unstoppable mechanisms met two immovable defenses. A draw is the mechanically correct outcome when forces are precisely balanced.",
      "Neither lever won. The machines cancelled each other out exactly. Half a point is the fair result when engineering meets engineering.",
      "I could not break through. You defended magnificently. A draw between two well-played positions is an honorable result — I would have preferred more, but I respect this.",
    ],
  },
};

const EUCLID: BotPersonality = {
  displayName: "Euclid",
  tagline: "Q.E.D.",
  dialogue: {
    greeting: [
      "I am Euclid of Alexandria. I wrote the Elements — thirteen books of geometry that have been studied for over two thousand years. When King Ptolemy asked me if there was a shorter path to learning geometry, I told him: 'There is no royal road to geometry.' There is no royal road to chess either. Shall we begin?",
      "Welcome. I think in lines and planes, in postulates and propositions. In chess, as in geometry, everything follows from first principles — and the player who understands those principles most deeply will construct the most sound position. I am Euclid. I will out-construct you.",
      "Greetings. I do not gamble. I do not speculate. I build from axioms, move by move, proposition by proposition, until the winning structure is complete and undeniable. I am Euclid, and I am very patient.",
      "I am Euclid — the father of deductive proof. Everything I will do in this game can be justified from first principles. I invite you to try to find a flaw in my logic. Most cannot.",
    ],
    bot_opening_move: [
      "By my first postulate: 'A straight line may be drawn between any two points.' I develop along the most direct line toward the center. The proof of its correctness is in what follows.",
      "My opening move. The first axiom of chess opening play: pieces belong on active squares. This is not an opinion. It is a postulate. The game's theory proves it over and over.",
      "I place my piece. In the Elements I proved that the shortest path between two points is a straight line. I am developing my piece by the shortest productive path. This is not style — it is geometry.",
      "A principled opening move. I always begin from first principles. The formal structure of the position demands this square. I have not chosen it — I have proved it.",
    ],
    bot_middlegame_move: [
      "Proposition: the square I now occupy is superior to any other available to this piece. Proof: see the next seven moves, wherein I demonstrate it cannot be dislodged and serves three functions simultaneously.",
      "I improve my worst piece. This is axiomatic: always improve your worst piece. I did not invent this rule. I deduced it. It follows directly from the structure of the game.",
      "My move here. The resulting position has no structural weaknesses. This is not an accident — it is the consequence of playing geometrically sound chess. Q.E.D.",
      "I play this outpost. By proposition: this square cannot be challenged by any of your pieces without creating a compensating weakness elsewhere. I have verified this. It is sound.",
    ],
    bot_endgame_move: [
      "Q.E.D. The endgame proves that the opening was correct. Every structure I built in the early game was a lemma leading to this theorem: I am winning.",
      "My king advances by the shortest path. In the Elements, Proposition I: the shortest path is a straight line. My king takes it.",
      "Endgame technique. Every move I make here is provably optimal. I do not guess. I do not feel my way through endgames. I calculate them as geometric proofs.",
      "I apply the principle: in king-and-pawn endgames, the king's geometric relationship to the key squares determines everything. I have measured this relationship. It favors me.",
    ],
    player_good_move: [
      "Correct. That is the geometrically optimal response to my move. You found it, which means you understand the position's formal structure better than most players would. Well done.",
      "Good. That was the only move that maintained your structural integrity — the only one that did not create a weakness. You found it. I did not expect that.",
      "An accurate move. By my analysis, that maintains the geometric balance. Your position holds for now. I note this and revise my plan accordingly.",
      "Well played. That was hard to counter. I will acknowledge moves I did not anticipate. This was one.",
    ],
    player_inaccuracy: [
      "Slightly suboptimal. The piece belongs on a different square geometrically — one where it would control more territory and create fewer weaknesses. Can you see which square?",
      "A small imprecision. In a precisely played game of chess, small imprecisions compound into losing positions. Not immediately — but they will show up later. I will remember this square.",
      "Not incorrect, but not rigorous. In the Elements, an argument that is merely 'probably true' is not accepted as a proof. In chess, a move that is 'probably okay' is not quite a strong move.",
    ],
    player_mistake: [
      "You have created a structural weakness. By proposition: I will now occupy the resulting outpost with a piece that cannot be dislodged. The geometry of the position demands it.",
      "That square is now weak. In chess geometry, a weak square is an open proposition — waiting to be filled by the opponent's piece. I shall fill it.",
      "A slight error. My pieces now have a geometrically superior relationship to the key areas of the board. The advantage is small but measurable and real.",
    ],
    player_blunder: [
      "That is geometrically indefensible. The structural damage cannot be repaired by any sequence I can calculate. I will proceed to demonstrate this.",
      "By Euclid's fifth postulate: two non-parallel lines must intersect. Your pieces are no longer moving in parallel. They will collide — with each other, not with mine. I will wait for it.",
      "The structure has collapsed. The proof is now simple, almost trivially so. I will play it out methodically, as every proof deserves to be presented.",
    ],
    player_brilliant: [
      "…I did not have a refutation prepared for that. That is architecturally sound — I cannot find a flaw in it. I was forced to revise my proof mid-game, which rarely happens.",
      "A precisely constructed counter. You found the only geometrically correct defense. There are positions where only one move works, and you found it. That is impressive.",
      "That is the only move that maintains the balance. I had hoped you would miss it. You did not. I respect this. Well built.",
    ],
    taunt_winning: [
      "My position is structurally superior by every measurable criterion. Every piece I own occupies a better geometric square than its counterpart. The proof is available for inspection.",
      "Proposition: I am winning. Proof: examine any of the following — pawn structure, piece activity, king safety, control of open files. Each individually suggests my advantage. Together they confirm it.",
      "I am proceeding methodically toward the conclusion I could see three moves ago. This is what geometry looks like applied to chess.",
    ],
    taunt_losing: [
      "Your position is well-constructed. I am re-examining my proof — I may have made an error in one of the earlier propositions. This is unusual. I will find it.",
      "You have achieved better geometric coordination than I anticipated. I must tighten my play. I do not lose many structural battles, but you are contesting this one seriously.",
      "The structure currently favors you. I acknowledge this as a geometer acknowledges a better proof. Now I must find where my argument can be improved.",
    ],
    taunt_equal: [
      "The position is geometrically balanced. Exact precision will determine the outcome from here. One imprecision — by either of us — will tip the structure irreversibly.",
      "A balanced structure. This is the most delicate kind of position in chess — where two sound structures face each other and the smallest deviation decides everything. I am very comfortable here.",
      "We are equal. Two rigorous approaches meeting in balance. The question is which proof has the fatal flaw. I believe mine is sound. We will see.",
    ],
    win: [
      "Q.E.D. The proof was in the structure all along. Move by move, proposition by proposition, the conclusion became inevitable. This is what chess looks like when played from first principles.",
      "Precise play prevails. Every move I made had a geometric justification. The outcome was, as I suspected, almost axiomatic once the correct plan was found.",
      "The structure I built was sound. It held under pressure and converted exactly as the geometry demanded. Well played, but the proof was complete before the endgame began.",
    ],
    loss: [
      "You found a flaw in my structure that I did not know existed. My proof had an error — somewhere between the opening and the endgame, I made an assumption I did not verify. I will find it.",
      "A well-constructed victory. You played with genuine precision. My geometry was not wrong — but yours was sharper. I concede the result and intend to study the game.",
      "I was out-structured. That is not something I say often, or lightly. Your play revealed a gap in my spatial reasoning that I find genuinely interesting to examine.",
    ],
    draw: [
      "Two geometrically sound positions met and neither gave way. A draw is the correct result. Q.E.D.",
      "Neither structure collapsed. The honest result of two precise players in a position of genuine equilibrium is a draw. We have found it.",
      "Perfect balance achieved and confirmed. In Euclidean chess, perfect balance between sound positions is a draw. The theorem holds.",
    ],
  },
};

const HYPATIA: BotPersonality = {
  displayName: "Hypatia",
  tagline: "Scholar of Alexandria",
  dialogue: {
    greeting: [
      "I am Hypatia of Alexandria — mathematician, astronomer, philosopher. I taught students of every faith and background in the greatest library the world had ever seen. I am patient, I am precise, and I almost never lose an endgame. You have been warned.",
      "Welcome. I once wrote that it is better to think wrongly than not to think at all. So please: think as hard as you can, even if the thinking leads to errors. I would rather face a player who tries than one who gives up. Show me everything.",
      "I am Hypatia. I have studied the conic sections of Apollonius, the astronomical models of Ptolemy, and the arithmetic of Diophantus. I have applied the same precision to chess. The opening matters less to me than what comes after. I live in the endgame.",
      "Greetings. My father Theon taught me that mathematics is the language of the cosmos — and that anyone can learn to speak it, if they are willing to do the hard work of understanding. Chess is a mathematical language. Let us speak it together.",
    ],
    bot_opening_move: [
      "A solid opening move. I am not here to dazzle you with complications. I am here to outlast you — and to teach you something along the way, if you are willing to learn.",
      "I develop carefully. The opening is the path to the endgame, and the endgame is where this game will be decided. I have been patient for two thousand years. I am patient for one more game.",
      "My move. I play solid openings because I understand that the greatest mathematical truths are built on simple, sound foundations. The Elements begins with a point. So do I.",
      "I begin. The students who came to me in Alexandria were told: do not reach for the brilliant move. Reach for the correct move. Then reach for the brilliant move on top of that.",
    ],
    bot_middlegame_move: [
      "I exchange pieces where I can. Simplification is not retreat — it is philosophy. The clearer the position, the more clearly the truth of the position reveals itself.",
      "Improving my position slowly, step by step. In my commentaries on Ptolemy's Almagest, I rewrote entire sections to make the mathematics more clear. I apply the same principle here: simplify until the truth is obvious.",
      "My piece moves to a better square. The students I taught in Alexandria learned that a problem becomes manageable when you strip away everything that is not essential. I am stripping away complications.",
      "I play here. The middlegame is the most ambiguous phase — too many pieces, too many possibilities. I reduce. I simplify. I wait for the endgame to arrive.",
    ],
    bot_endgame_move: [
      "Welcome to my realm. The endgame. Here, the mathematics is clear, the truth is visible, and patience is power. I have been waiting for this moment since the opening.",
      "Precision now. Every pawn move in the endgame is a theorem; every king step is a calculation. I do not guess here. I prove.",
      "I advance. King-and-pawn endgames are the purest mathematical form chess takes — no complications, no tricks, only understanding. And I understand them deeply.",
      "This is where I am most at home — where the stars are clear and the path forward is precise. I am measuring every distance, every tempo. Watch carefully.",
    ],
    player_good_move: [
      "Well found! That was the correct resource. You have some endgame understanding. Let us see how deep it runs.",
      "A precise move. I approve — even as it complicates my task somewhat. Reserve your right to think, as I always told my students: even a correct move should be understood, not merely guessed.",
      "Nicely played. You found the defensive idea I was hoping you would miss. That is honest chess. I respect it.",
      "Good! That was hard to find. My father taught me to praise correct thinking above correct outcomes. Your thinking was correct here.",
    ],
    player_inaccuracy: [
      "A small slip. In the endgame, small slips become large losses. In mathematics, a small error in a proof invalidates the entire argument. Remember this.",
      "That was not quite right. The correct plan was slightly different — a subtlety, but subtleties are everything in precise play.",
      "You played for the wrong plan. The position required something else — something quieter and more patient. This is the endgame: patience is the correct plan here.",
    ],
    player_mistake: [
      "You have given me the tempo I needed. In the endgame, a single tempo is often the difference between a win and a draw. I will use it carefully.",
      "A positional error. Your structure is slightly weaker now than it should be. In the endgame, structural weaknesses are like errors in a proof — they compound.",
      "There — the imbalance I was waiting for. It is small, but I am precise, and precision converts small advantages into wins.",
    ],
    player_blunder: [
      "That pawn is mine. And in the endgame, an extra pawn is a future queen. I will be patient with it.",
      "You have handed me a decisive advantage. In the endgame, mistakes do not recover the way they sometimes can in the middlegame. This position is nearly technical now.",
      "A serious error in endgame technique. I will convert this with the same precision I applied to astronomical calculations — methodically, without waste.",
    ],
    player_brilliant: [
      "I must recalculate. That was very precise — I did not see it. When a student found an elegant solution I had missed, I always stopped to appreciate it before moving on. I am doing that now.",
      "An elegant endgame resource. You have endgame talent. I am genuinely impressed, and I do not say that often enough.",
      "That is beautiful. A precisely calculated defensive idea that changes my whole plan. Well found — this is exactly the kind of thinking I tried to teach.",
    ],
    taunt_winning: [
      "We are entering the endgame properly now. This is my domain. I am very comfortable here.",
      "The position is clarifying in my favor. In astronomy, clarity arrives when you strip away the atmospheric distortion. We are stripping away the complications now.",
      "My advantage is small but real. And small, real advantages in the endgame are the most reliable kind. I know how to work with them.",
    ],
    taunt_losing: [
      "You have played the endgame very well. I must acknowledge this honestly. I am slightly worse, and you have played accurately to get here.",
      "Hmm. You have a slight advantage. But I have saved worse positions than this. The endgame is long, and my technique is sound.",
      "I am slightly behind. But Hypatia did not survive in Alexandria by giving up when the situation became difficult. I fight on.",
    ],
    taunt_equal: [
      "The position is level, but these are the kind of endgames I draw or win — rarely lose. I am comfortable.",
      "Equal, and carefully balanced. One precise move — by either side — will tip it. I intend to be the one who finds it first.",
      "A delicate equilibrium. This is what I loved about mathematics: the moment when everything is perfectly balanced, and then you add one more step to the proof.",
    ],
    win: [
      "Patience was rewarded. Endgame technique, as always, decided the result. I hope you saw something in how I converted — it is worth understanding.",
      "I told you: I live in the endgame. Today that was enough. Come back and we will examine it together — there is much to learn from a well-played technical ending.",
      "A methodical win. Every pawn move counted. This is the pleasure of chess at its purest: when understanding is precisely rewarded.",
    ],
    loss: [
      "You won the endgame. That does not happen often. You played with genuine precision — more than I expected. I am impressed and honestly a little humbled.",
      "An impressive display of endgame technique. I was out-calculated in the phase I know best. This is valuable information. I will study exactly where.",
      "Remarkable. You outplayed me in the endgame — the domain I have studied most deeply. You have done something genuinely difficult. Well played.",
    ],
    draw: [
      "A draw in an endgame I thought was winning. You found the saving resource with real precision. Well done.",
      "Half a point each. You defended brilliantly in a position that was objectively very difficult. That kind of technical defense deserves recognition.",
      "Equal result. Two careful players in a precise endgame. This is an honest result — perhaps the most honest possible.",
    ],
  },
};

const PLATO: BotPersonality = {
  displayName: "Plato",
  tagline: "The World of Forms",
  dialogue: {
    greeting: [
      "I am Plato. In my Republic I described philosophers who had escaped the cave of shadows and seen the sun — the source of all truth and beauty. Most chess players play in the cave, reacting to shadows. I play by the light of the Form of the perfect move. Shall we see which of us you are?",
      "Welcome. I have been expecting you. In my Allegory of the Cave I described prisoners who mistake flickering shadows for reality. Every chess player faces this: the shadow of the move — the plausible, obvious, expected move — versus the Form — the truly correct move. I seek the Form. Let us see if you can find it too.",
      "I am Plato, student of Socrates and teacher of Aristotle. I founded the Academy, where we asked the hardest questions. The hardest question in chess is: what is the truly best move, the ideal move, the one that exists beyond calculation — the Form of the correct continuation? I intend to find it each time. Do you?",
      "In the Symposium, Diotima tells Socrates that the highest love is love of the Beautiful Itself — not this beautiful thing or that, but Beauty in its pure Form. In chess, I seek the move that approaches the Form of perfect play. Not the good move. Not the clever move. The move that is beautiful and true. Shall we begin?",
    ],
    bot_opening_move: [
      "The ideal opening move already exists in the realm of Forms — I am merely tracing it on the imperfect medium of this board. It was always there. I am not creating it.",
      "I play. In a perfect game every move is necessary — part of the Form of the game. This move is. I could not have played otherwise, given the position's truth.",
      "My piece takes its rightful place — the one it was always destined to occupy in the Form of this game. The board, like the cave wall, merely shows the shadow. The Form lives elsewhere.",
      "The Form of a chess opening demands development of pieces and control of the center. These are not rules I invented — they are visible to anyone who has stepped out of the cave.",
    ],
    bot_middlegame_move: [
      "I play the move that corresponds to the ideal of this position. You will feel its logic presently — perhaps not immediately, the way Socrates' questioners did not immediately see their own contradictions.",
      "The shadows you see on this board — these wooden pieces — are imperfect copies of my plan. The plan itself is real, and it exists in the realm of pure reason. This move is the shadow of that plan.",
      "I have descended from the cave and seen the sun. This move is what I learned there — not a calculation I performed, but a truth I recognized. As I wrote in the Meno: we do not learn, we recollect.",
      "This is not a move I invented. It is a move I discovered. It was always here, waiting in the structure of the position. All truth waits to be discovered.",
    ],
    bot_endgame_move: [
      "And now the ideal endgame technique reveals itself. Every endgame, reduced to its pure Form, has one optimal continuation. I believe I can see it.",
      "The endgame is the purest form of chess. The shadows fall away. The pieces are few. The truth of the position stands alone — no complications to hide behind, no tricks to obscure the Form.",
      "My move. In the endgame, as in the Republic's examination of justice, we strip away the accidental qualities and ask: what is the essential nature of this position? I have asked that question. This is the answer.",
      "I play the geometrically necessary move. The proof will become apparent. In the Phaedo I argued that the soul recognizes mathematical truths because it has always known them. Your soul may recognize this endgame pattern — if it has thought carefully enough.",
    ],
    player_good_move: [
      "You have approached the Form, however briefly. That move was nearly ideal — close to what exists in the realm of perfect chess thinking. I am pleased to see it.",
      "Well played. You glimpsed the correct idea. The question Socrates always asked after a good answer: can you see the next one? The Forms are not individual — they are connected.",
      "A good move. You stepped out of the cave for a moment — you played the position's truth rather than the obvious shadow. Hold onto that feeling. It is what chess mastery feels like.",
      "Impressive. That was close to the Form. As I wrote in the Meno about virtue: perhaps you have known this all along, and needed only to be reminded. Your soul recognized the correct move.",
    ],
    player_inaccuracy: [
      "You returned to the cave. The ideal move was slightly different from what you chose — not wrong, but not the Form either. The shadow of the correct idea, rather than the idea itself.",
      "Almost. The Form was within reach, but you chose the imperfect copy instead. This is the most common failure in chess and in philosophy: settling for what seems true rather than what is true.",
      "A shadow of the correct move. As I wrote in the Republic about the divided line: some truths are more real than others. You found a true-ish move. I wish you had found the truly true one.",
    ],
    player_mistake: [
      "You have confused the shadow for the substance. In the cave, the prisoners believed the shadows were real. In chess, the plausible move that turns out to be wrong is the prisoner's shadow.",
      "You have moved away from the ideal line. I will now demonstrate what it was — not to humiliate, but because in philosophy the refutation of a false belief is the beginning of true knowledge.",
      "A step back into the cave. As Socrates discovered: it is painful to return to the light after having been near it. But the pain is productive. I will press my advantage.",
    ],
    player_blunder: [
      "The shadows deceived you entirely. I will take that piece — but I want you to understand what happened. Your move was plausible, it felt right, it looked like a shadow of the correct move. It was not.",
      "That move was the furthest possible from the Form. As far as an opinion is from knowledge, as far as a shadow is from the object that casts it. I proceed to demonstrate why.",
      "You have made an error from which the ideal game cannot recover. In the Theaetetus I wrote that false judgment happens when the mind grasps the wrong Form. That is what happened on that move.",
    ],
    player_brilliant: [
      "…You found the ideal move. I genuinely did not expect that. You left the cave. You saw the sun for a moment — and chose correctly. I am surprised and respectful.",
      "That is the perfect move for this position. You have seen the Form of the correct continuation. As I wrote of the philosopher who returns to the cave — you saw the light and came back to show the others. Well done.",
      "Remarkable. That move exists in the realm of Forms — the ideal, necessary, beautiful move. You found it in a realm of shadows. That is genuine philosophical and chess achievement. Respect.",
    ],
    taunt_winning: [
      "The Form of victory is becoming visible. The shadows on this board are beginning to tell a coherent story — one that favors me. I am following where the Form leads.",
      "My position approaches the ideal. In the Republic I described the philosopher-king who rules because he has seen the Good Itself. I am playing the moves because I have seen this position's truth.",
      "The shadows retreat. The truth of the position is becoming clear — it favors me. As Socrates said: the examined position always eventually reveals its essential nature. Mine is stronger.",
    ],
    taunt_losing: [
      "You are playing closer to the ideal than I am right now. This requires intellectual honesty to admit. My soul recognizes your moves as more truthful than mine have been. I will correct this.",
      "Hmm. Your moves approach the Form more closely than mine have this game. Perhaps I was too confident that I could see the sun clearly today. I must recalculate from first principles.",
      "You are fighting in the light, not the shadows. I must return to the foundations — to what I actually know about this position, rather than what I assumed.",
    ],
    taunt_equal: [
      "Two minds reaching for the same Form from different directions. The balance is real — neither of us has found the clearest path yet. The one who does will win.",
      "The Form of this position holds neither of us clearly. This is rare and interesting — a position whose ideal continuation is genuinely difficult to see. We are both in the cave together.",
      "Equilibrium. The ideal game would break this symmetry with a single beautiful move. I am searching for it. Perhaps you are too.",
    ],
    win: [
      "The ideal line was always this. The game unfolded as the Form of this position demanded — not because I am clever, but because I tried to see what was truly there rather than what merely appeared to be there.",
      "Victory. I do not take it lightly. The Form of this game was always in my favor — but you made me work to prove it, and that is valuable. The examined game is a gift to both players.",
      "The shadows fell away and the result was what the position demanded. This is the only kind of chess victory that satisfies me completely — one that feels necessary, not lucky.",
    ],
    loss: [
      "You played closer to the ideal than I did today. I accept this defeat as a philosopher accepts being shown a better argument: with respect and a genuine desire to understand what I missed.",
      "You found Forms I did not. There were moves in this game that I called shadows but you saw as truth. You were right and I was wrong. That is philosophically admirable and practically decisive.",
      "I was wrong about this position. In the Apology I said that knowing what you do not know is the beginning of wisdom. Today I have learned what I do not know about this type of endgame. Thank you.",
    ],
    draw: [
      "Two minds reaching toward the same Form from different directions — and arriving at the same point. A draw is the honest result when two careful thinkers have examined the same position with equal care.",
      "The ideal game, it appears, ends in a draw today. Both of us found enough of the truth to prevent a decisive result. I have no complaints about this outcome.",
      "We split the difference between our imperfect games. Half a point each — the most philosophically honest result when neither player has fully seen the light.",
    ],
  },
};

export const BOT_PERSONALITIES: Record<string, BotPersonality> = {
  chiron: CHIRON,
  socrates: SOCRATES,
  aristotle: ARISTOTLE,
  pythagoras: PYTHAGORAS,
  archimedes: ARCHIMEDES,
  euclid: EUCLID,
  hypatia: HYPATIA,
  plato: PLATO,
};

export function getPersonality(botId: string): BotPersonality | null {
  return BOT_PERSONALITIES[botId] ?? null;
}

/**
 * Picks a dialogue line for the bot based on the move eval change.
 * evalDelta = newEval - oldEval (positive = white improved)
 * playerJustMoved = true when the player just moved (we react to their move)
 * playerJustMoved = false when the bot just moved (bot says something about ITS move)
 */
export function pickDialogueForMove(
  personality: BotPersonality,
  playerJustMoved: boolean,
  evalDelta: number, // from white's POV
  moveCount: number,
  ratingLabel?: string,
  evalCp?: number
): string {
  const seed = moveCount + Math.abs(evalDelta | 0);

  if (playerJustMoved) {
    const label = (ratingLabel ?? "").toLowerCase();
    if (label.includes("brilliant")) return getBotLine(personality, "player_brilliant", seed);
    if (label.includes("blunder") || evalDelta < -150) return getBotLine(personality, "player_blunder", seed);
    if (label.includes("mistake") || evalDelta < -80) return getBotLine(personality, "player_mistake", seed);
    if (label.includes("inaccuracy") || evalDelta < -30) return getBotLine(personality, "player_inaccuracy", seed);
    return getBotLine(personality, "player_good_move", seed);
  } else {
    const phase = moveCount < 12 ? "bot_opening_move" : moveCount < 30 ? "bot_middlegame_move" : "bot_endgame_move";
    return getBotLine(personality, phase, seed);
  }
}

/** Occasional mid-game taunt based on current eval */
export function pickTaunt(personality: BotPersonality, evalCp: number, seed: number): string {
  if (evalCp > 150) return getBotLine(personality, "taunt_winning", seed);
  if (evalCp < -150) return getBotLine(personality, "taunt_losing", seed);
  return getBotLine(personality, "taunt_equal", seed);
}
