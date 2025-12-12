import { supabase } from "../lib/supabase.js";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

//Front end services and util functions
function getUserId() {
    let userId = localStorage.getItem("userId");
    if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem("userId", userId);
    }
    return userId;
}

export async function getTodayQuiz() {
    const { data, error } = await supabase
        .rpc("get_today_quiz_rpc");   // returns { country_ids: number[] }

    if (error) {
        console.error("Quiz fetch error:", error);
        return [];
    } else {
        //DEBUG console.log(data);
    }

    return data[0].country_ids || [];
}

export async function validateAnswer(userId, countryId, isCorrect) {
    // 1️⃣ Insert user answer — let DB fill the date
    const { error: insertError } = await supabase
        .from('quiz_answers')
        .insert({
            user_id: userId,
            country_id: countryId,
            is_correct: isCorrect
            // answer_date omitted, DB uses default current_date
        });

    if (insertError) {
        console.error('Error inserting answer:', insertError);
        return false;
    }

    // 2️⃣ Call RPC to update aggregation table
    /* const { error: rpcError } = await supabase.rpc('increment_stats', {
        p_country_id: countryId,
        p_is_correct: isCorrect
    });

    if (rpcError) {
        console.error('Error updating aggregated stats:', rpcError);
        return false;
    } */

    return true;
}

async function getUserStats() {
    const { data, error } = await supabase
        .from('quiz_answers')
        .select('correct')
        .eq('user_id', userId)

    if (error) {
        console.error('Error fetching user stats:', error)
        return 0
    }

    const total = data.length
    const correct = data.filter(r => r.correct).length
    return total ? (correct / total) * 100 : 0
}


export async function getGlobalStats(todayCountries) {
    
    // If it's a Promise → await it
    if (todayCountries instanceof Promise) {
        todayCountries = await todayCountries;
    }

    // If it's null / undefined → bail out
    if (!todayCountries) {
        console.warn("getTodayQuiz() returned empty value");
        return [];
    }

    const { data, error } = await supabase
        .from('aggregated_stats')
        .select('country_id, total_answers, correct_answers')
        .in('country_id', todayCountries);

    if (error) {
        console.error('Error fetching aggregated stats:', error);
        return [];
    }

    // Compute percentage correctness
    return data.map(row => ({
        country_id: row.country_id,
        total_answers: row.total_answers,
        correct_answers: row.correct_answers > 0 ? row.correct_answers: 0,
        correctness_pct:
            row.total_answers > 0
                ? (row.correct_answers / row.total_answers) * 100
                : 0
    }));
}

function computePercentage(stats, countryId) {
    const items = stats.filter(r => r.country_id === countryId);
    if (items.length === 0) return "No data";

    const correct = items.filter(r => r.correct === true).length;
    const percent = Math.round((correct / items.length) * 100);

    return percent + "% correct";
}

async function answer(countryId, isCorrect) {
    await submitAnswer(countryId, isCorrect);
    const countryIds = await getTodayQuiz();
    updateStats(countryIds);
}