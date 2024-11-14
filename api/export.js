const { Octokit } = require('@octokit/rest');

const MAX_FILE_SIZE = 500000; // 500KB
const MAX_FILES_PER_CHUNK = 10;

module.exports = async (req, res) => {
    try {
        console.log('Recibida solicitud:', req.body);
        const { repoUrl, token } = req.body;

        if (!repoUrl) {
            return res.status(400).json({ message: 'URL del repositorio es requerida' });
        }

        const urlParts = repoUrl.replace('https://github.com/', '').split('/');
        const owner = urlParts[0];
        const repo = urlParts[1]?.replace('.git', '');

        console.log(`Procesando repositorio: ${owner}/${repo}`);

        const octokit = new Octokit({
            auth: token || process.env.GITHUB_TOKEN
        });

        // Verificar acceso al repositorio
        try {
            await octokit.repos.get({ owner, repo });
        } catch (error) {
            return res.status(404).json({ 
                message: 'Repositorio no encontrado o sin acceso' 
            });
        }

        // Obtener lista de archivos
        const fileList = await getFileList(octokit, owner, repo);
        console.log(`Total archivos encontrados: ${fileList.length}`);

        // Filtrar archivos por tamaño
        const validFiles = fileList.filter(file => file.size <= MAX_FILE_SIZE);
        const skippedFiles = fileList.filter(file => file.size > MAX_FILE_SIZE);

        // Iniciar contenido
        let content = `CodeForias - Exportación de Repositorio\n`;
        content += `Fecha: ${new Date().toISOString()}\n`;
        content += `Repositorio: ${owner}/${repo}\n\n`;
        
        // Agregar archivos omitidos
        if (skippedFiles.length > 0) {
            content += `\nArchivos omitidos por tamaño:\n`;
            skippedFiles.forEach(file => {
                content += `- ${file.path} (${(file.size/1024).toFixed(2)}KB)\n`;
            });
        }

        content += `\nEstructura de Archivos:\n${'='.repeat(50)}\n`;
        validFiles.forEach(file => {
            content += `file: ${file.path}\n`;
        });

        content += `\nContenido de Archivos:\n${'='.repeat(50)}\n`;

        // Procesar archivos en chunks
        for (let i = 0; i < validFiles.length; i += MAX_FILES_PER_CHUNK) {
            const chunk = validFiles.slice(i, i + MAX_FILES_PER_CHUNK);
            const contents = await getContents(octokit, owner, repo, chunk);
            
            contents.forEach(file => {
                content += `\n${'='.repeat(80)}\n`;
                content += `Archivo: ${file.path}\n`;
                content += `${'='.repeat(80)}\n`;
                content += file.content + '\n';
            });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `codeforias_${owner}_${repo}_${timestamp}.txt`;

        return res.status(200).json({
            success: true,
            filename,
            content
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            message: 'Error procesando el repositorio: ' + error.message
        });
    }
};

async function getFileList(octokit, owner, repo, path = '') {
    const files = [];

    async function processDirectory(path) {
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path
        });

        for (const item of data) {
            if (item.type === 'dir') {
                await processDirectory(item.path);
            } else if (item.type === 'file') {
                files.push({
                    path: item.path,
                    size: item.size
                });
            }
        }
    }

    await processDirectory(path);
    return files;
}

async function getContents(octokit, owner, repo, files) {
    const contents = await Promise.all(
        files.map(async file => {
            try {
                const { data } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: file.path
                });

                return {
                    path: file.path,
                    content: Buffer.from(data.content, 'base64').toString('utf-8')
                };
            } catch (error) {
                return {
                    path: file.path,
                    content: `Error al procesar archivo: ${error.message}`
                };
            }
        })
    );

    return contents;
}